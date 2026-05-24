import type { AIProvider, RuleResult, StoryBible, WorldState } from "@/types";
import { buildNPCLocalView } from "./npcKnowledgeFilter";
import { generateNPCActionProposal } from "./npcPlanner";
import { processNPCAction } from "./ruleEngine";
import { applyUpdates, createInitialNPCRuntime } from "./worldStateEngine";
import type { MemoryEntry, NPC, NPCRuntimeState, StateUpdate } from "@/types";

export interface NPCTurnResult {
  npc_id: string;
  npc_name: string;
  skipped: boolean;
  proposal?: Awaited<ReturnType<typeof generateNPCActionProposal>>;
  result?: RuleResult;
  public_result?: string;
}

export async function runDueNPCTurns(
  state: WorldState,
  bible: StoryBible,
  aiProvider: AIProvider
): Promise<{ worldState: WorldState; npcResults: NPCTurnResult[] }> {
  let worldState = ensureNPCRuntimeState(state, bible);
  const npcResults: NPCTurnResult[] = [];

  for (const npc of bible.npcs) {
    const runtime = worldState.npc_runtime_state[npc.id];
    const frequency = runtime?.action_frequency || 2;

    worldState = observeAndThink(npc, worldState, bible);

    if (worldState.turn === 0 || worldState.turn % frequency !== 0 || runtime?.last_action_turn === worldState.turn) {
      npcResults.push({ npc_id: npc.id, npc_name: npc.name, skipped: true });
      continue;
    }

    const localView = buildNPCLocalView(npc, worldState, bible);
    const proposal = await generateNPCActionProposal(npc, localView, aiProvider);
    const result = processNPCAction(proposal, worldState, bible);
    worldState = applyUpdates(worldState, result.state_updates);

    npcResults.push({
      npc_id: npc.id,
      npc_name: npc.name,
      skipped: false,
      proposal,
      result,
      public_result: result.public_result,
    });
  }

  return { worldState, npcResults };
}

function ensureNPCRuntimeState(state: WorldState, bible: StoryBible): WorldState {
  const next: WorldState = {
    ...state,
    active_modifiers: state.active_modifiers || [],
    npc_runtime_state: { ...(state.npc_runtime_state || {}) },
  };

  for (const npc of bible.npcs) {
    next.npc_runtime_state[npc.id] = normalizeRuntime(npc, next.npc_runtime_state[npc.id], state.chapter);
  }

  return next;
}

function observeAndThink(npc: NPC, state: WorldState, bible: StoryBible): WorldState {
  const runtime = normalizeRuntime(npc, state.npc_runtime_state[npc.id], state.chapter);
  const knownActions = runtime.known_player_actions.slice(-8);
  const threatScores: Record<string, { level: number; reasons: string[] }> = {};

  for (const action of knownActions) {
    const score = threatScores[action.actor_id] || { level: 0, reasons: [] };
    if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type)) {
      score.level += 25;
      score.reasons.push(`Observed investigation at ${action.target}`);
    }
    if (["persuade", "command", "gain_support"].includes(action.action_type)) {
      score.level += 15;
      score.reasons.push(`Observed social or faction influence`);
    }
    if (isTargetNearSecret(action.target, runtime.protected_secrets)) {
      score.level += 25;
      score.reasons.push(`Action target appears related to a protected secret`);
    }
    threatScores[action.actor_id] = score;
  }

  const suspicionMetric = findVisibleMetricValue(state, bible, [
    "suspicion", "pressure", "tension", "risk", "alert", "怀疑", "压力", "紧张", "风险", "警戒",
  ]);
  const progressMetric = findVisibleMetricValue(state, bible, [
    "truth_progress", "progress", "truth", "clue", "evidence", "investigation", "discovery",
    "真相", "进度", "线索", "证据", "调查", "发现",
  ]);
  for (const score of Object.values(threatScores)) {
    if (Number(suspicionMetric) >= 60) {
      score.level += 10;
      score.reasons.push("Public suspicion or pressure is high");
    }
    if (Number(progressMetric) >= 70) {
      score.level += 25;
      score.reasons.push("Public truth progress is dangerously high");
    }
  }

  const suspicion_towards_players = Object.fromEntries(
    Object.entries(threatScores).map(([playerId, score]) => [playerId, Math.min(100, score.level)])
  );
  const threat_targets = Object.entries(suspicion_towards_players)
    .filter(([, level]) => level >= 50)
    .sort((a, b) => b[1] - a[1])
    .map(([playerId]) => playerId);

  const observations = Object.entries(threatScores)
    .flatMap(([playerId, score]) => score.reasons.map((reason) => `${playerId}: ${reason}`))
    .slice(-6);
  const memoryUpdates: StateUpdate[] = observations.map((content, index) => ({
    type: "append_npc_memory",
    target: npc.id,
    value: content,
    memory: {
      id: `memory_${npc.id}_${state.turn}_${index}_${safeId(content)}`,
      timestamp: state.turn,
      source: "observation",
      importance: content.includes("dangerously") ? 85 : 55,
      content,
    },
  }));

  return applyUpdates(state, [
    {
      type: "update_npc_runtime",
      target: npc.id,
      npc_runtime: {
        ...runtime,
        current_goal: inferStageGoal(runtime.core_goal, runtime.protected_secrets[0] || "", state.chapter, progressMetric),
        current_plan: selectPlan(runtime, threat_targets, Number(progressMetric)),
        suspicion_towards_players,
        threat_targets,
        relationships: state.relationships
          .filter((relationship) => relationship.source_id === npc.id || relationship.target_id === npc.id)
          .map((relationship) => ({
            target_id: relationship.source_id === npc.id ? relationship.target_id : relationship.source_id,
            type: relationship.type,
            value: relationship.value,
          })),
      },
    },
    ...memoryUpdates,
  ]);
}

function normalizeRuntime(npc: NPC, runtime: NPCRuntimeState | undefined, chapter: number): NPCRuntimeState {
  const initial = createInitialNPCRuntime(npc);
  const memory_log = (runtime?.memory_log || initial.memory_log).map((memory, index) =>
    typeof memory === "string"
      ? ({
          id: `legacy_memory_${npc.id}_${index}`,
          timestamp: 0,
          source: "legacy",
          importance: 50,
          content: memory,
        } satisfies MemoryEntry)
      : memory
  );

  return {
    ...initial,
    ...runtime,
    core_goal: runtime?.core_goal || npc.goal,
    current_goal: runtime?.current_goal || inferStageGoal(npc.goal, npc.secret_goal, chapter, 0),
    current_plan: runtime?.current_plan || runtime?.intervention_strategy || initial.current_plan,
    last_action_turn: runtime?.last_action_turn ?? -1,
    known_facts: runtime?.known_facts || initial.known_facts,
    suspected_facts: runtime?.suspected_facts || [],
    relationships: runtime?.relationships || [],
    threat_targets: runtime?.threat_targets || [],
    protected_secrets: runtime?.protected_secrets || initial.protected_secrets,
    active_modifiers: runtime?.active_modifiers || [],
    memory_log,
    consecutive_target_count: runtime?.consecutive_target_count || 0,
  };
}

function inferStageGoal(coreGoal: string, secret: string, chapter: number, progress: unknown): string {
  const progressValue = Number(progress || 0);
  if (progressValue >= 70) return `紧急保护秘密，误导接近真相的行动：${secret || coreGoal}`;
  if (chapter <= 1) return `隐藏真实意图并积累优势：${secret || coreGoal}`;
  if (chapter === 2) return `保护关键线索并削弱威胁目标：${secret || coreGoal}`;
  return `推进核心目标：${coreGoal}`;
}

function selectPlan(runtime: NPCRuntimeState, threatTargets: string[], progress: number): string {
  if (progress >= 70) return "fabricate_false_evidence_or_hide_clues";
  if (threatTargets.length > 0) return "observe_threat_and_obstruct_investigation";
  return runtime.intervention_strategy || "advance_core_goal";
}

function isTargetNearSecret(target: string, protectedSecrets: string[]): boolean {
  const targetText = target.toLowerCase();
  return protectedSecrets.some((secret) =>
    secret.toLowerCase().split(/\s+/).some((part) => part.length >= 4 && targetText.includes(part))
  ) || /secret|clue|evidence|record|archive|witness|investigation|hidden|秘密|线索|证据|记录|档案|证人|调查|隐藏/i.test(targetText);
}

function findVisibleMetricValue(state: WorldState, bible: StoryBible, candidates: string[]): unknown {
  const metric = state.metrics.find((item) => {
    const definition = bible.metrics.find((metricDef) => metricDef.id === item.metric_id);
    if (definition?.visibility !== "public" && definition?.visibility !== "conditional") return false;
    const haystack = `${item.metric_id} ${definition?.label || ""}`.toLowerCase();
    return candidates.some((candidate) => haystack.includes(candidate.toLowerCase()));
  });
  return metric?.value ?? 0;
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 24);
}
