import type { AIProvider, ActionProposal, ActionType, NPC, Role, RuleResult, StoryBible, StructuredAction, WorldState } from "@/types";
import { buildNPCLocalView } from "./npcKnowledgeFilter";
import { generateNPCActionProposal } from "./npcPlanner";
import { processPlayerAction } from "./ruleEngine";
import { applyUpdates, createInitialNPCRuntime } from "./worldStateEngine";
import type { MemoryEntry, NPCRuntimeState, StateUpdate } from "@/types";

export interface NPCTurnResult {
  npc_id: string;
  npc_name: string;
  actor_kind: "ai_player_role";
  role_id: string;
  skipped: boolean;
  proposal?: Awaited<ReturnType<typeof generateNPCActionProposal>>;
  result?: RuleResult;
  public_result?: string;
}

export async function runDueNPCTurns(
  state: WorldState,
  bible: StoryBible,
  aiProvider: AIProvider,
  controlledRoleIds: string[] = []
): Promise<{ worldState: WorldState; npcResults: NPCTurnResult[] }> {
  const controlledRoles = bible.roles.filter((role) => controlledRoleIds.includes(role.id));
  let worldState = ensureNPCRuntimeState(state, controlledRoles);
  const npcResults: NPCTurnResult[] = [];

  for (const role of controlledRoles) {
    const agent = roleToAgent(role);
    const runtime = worldState.npc_runtime_state[role.id];
    const frequency = runtime?.action_frequency || 2;

    worldState = observeAndThink(agent, worldState, bible);

    if (
      worldState.turn === 0 ||
      worldState.turn % frequency !== 0 ||
      runtime?.last_action_turn === worldState.turn ||
      worldState.character_states[role.id]?.ghost_mode
    ) {
      npcResults.push({
        npc_id: role.id,
        npc_name: role.name,
        actor_kind: "ai_player_role",
        role_id: role.id,
        skipped: true,
      });
      continue;
    }

    const localView = buildNPCLocalView(agent, worldState, bible);
    const proposal = await generateNPCActionProposal(agent, localView, aiProvider, { actorKind: "ai_player_role" });
    const structuredAction = proposalToPlayerRoleAction(proposal, role, worldState, bible);
    const result = processPlayerAction(structuredAction, worldState, bible);
    const visibleProposal = {
      ...proposal,
      action_type: structuredAction.action_type,
      target: structuredAction.target,
      method: structuredAction.method,
      visibility: proposal.visibility || inferActionVisibility(structuredAction),
    } satisfies ActionProposal;
    const publicResult = summarizeAIPlayerRoleAction(visibleProposal, result, bible, worldState);
    worldState = applyUpdates(worldState, [
      ...result.state_updates,
      {
        type: "update_npc_runtime",
        target: role.id,
        npc_runtime: {
          current_intention: proposal.intention,
          action_cooldown: 0,
          intervention_strategy: structuredAction.action_type,
          last_action_turn: worldState.turn,
          consecutive_target_id: structuredAction.target,
          consecutive_target_count:
            runtime?.consecutive_target_id === structuredAction.target
              ? (runtime?.consecutive_target_count || 0) + 1
              : 1,
        },
      },
      {
        type: "append_npc_memory",
        target: role.id,
        value: `${worldState.turn}: ${structuredAction.action_type} ${structuredAction.target} ${result.success ? "resolved" : "failed"}`,
        memory: {
          id: `memory_${role.id}_${worldState.turn}_${structuredAction.action_type}_${Date.now()}`,
          timestamp: worldState.turn,
          source: "ai_player_role_action",
          importance: result.success ? 70 : 45,
          content: `${role.name} attempted ${structuredAction.action_type} on ${structuredAction.target}: ${proposal.intention}`,
        },
      },
    ]);

    npcResults.push({
      npc_id: role.id,
      npc_name: role.name,
      actor_kind: "ai_player_role",
      role_id: role.id,
      skipped: false,
      proposal: visibleProposal,
      result,
      public_result: publicResult,
    });
  }

  return { worldState, npcResults };
}

function ensureNPCRuntimeState(state: WorldState, controlledRoles: Role[]): WorldState {
  const next: WorldState = {
    ...state,
    active_modifiers: state.active_modifiers || [],
    npc_runtime_state: { ...(state.npc_runtime_state || {}) },
    knowledge_state: {
      ...state.knowledge_state,
      npc_knowledge: { ...(state.knowledge_state.npc_knowledge || {}) },
    },
  };

  for (const role of controlledRoles) {
    const agent = roleToAgent(role);
    next.npc_runtime_state[role.id] = normalizeRuntime(agent, next.npc_runtime_state[role.id], state.chapter);
    next.knowledge_state.npc_knowledge[role.id] ||= {
      npc_id: role.id,
      known_facts: [...role.initial_knowledge],
      known_events: [],
      known_players: [],
      known_player_actions: [],
      relationships: {},
      suspicions: {},
      discovered_clues: [],
    };
  }

  return next;
}

function roleToAgent(role: Role): NPC {
  return {
    id: role.id,
    name: role.name,
    public_identity: role.public_identity,
    personality: `AI代管的玩家角色。公开身份：${role.public_identity}。私人背景：${role.private_background}`,
    goal: role.public_goal,
    secret_goal: role.secret_goal,
    memory: [role.private_background, ...role.abilities.map((ability) => `${ability.name}: ${ability.description}`)],
    initial_knowledge: role.initial_knowledge,
    knowledge_scope: "limited",
    behavior_style: inferRoleBehavior(role),
  };
}

function inferRoleBehavior(role: Role): NPC["behavior_style"] {
  const categories = new Set(role.abilities.map((ability) => ability.category));
  const secretText = `${role.private_background} ${role.secret_goal}`.toLowerCase();
  return {
    aggression: categories.has("combat") || /revenge|kill|assassin|复仇|刺杀|推翻|夺权/.test(secretText) ? 65 : 35,
    caution: categories.has("investigation") || /secret|hidden|秘密|调查|证据/.test(secretText) ? 70 : 45,
    cooperation: categories.has("social") ? 65 : 45,
    deception: categories.has("political") || categories.has("resource") || /deceive|lie|隐瞒|伪装|权谋/.test(secretText) ? 65 : 35,
  };
}

function proposalToPlayerRoleAction(
  proposal: ActionProposal,
  role: Role,
  state: WorldState,
  bible: StoryBible
): StructuredAction {
  const actionType = toPlayerActionType(proposal.action_type);
  return {
    actor_id: role.id,
    actor_type: "player",
    action_source: "npc_planner",
    action_type: actionType,
    target: normalizeAgentTarget(proposal.target, role.id, state, bible),
    method: proposal.method || "direct",
    intent: proposal.intention || actionType,
    risk_level: proposal.risk_level || "medium",
    raw_input: proposal.intention,
    metadata: {
      ai_controlled_role: true,
      visibility: proposal.visibility || inferActionVisibility({ action_type: actionType } as StructuredAction),
    },
  };
}

function toPlayerActionType(actionType: ActionProposal["action_type"]): ActionType {
  if (["mislead_player", "frame_player"].includes(actionType)) return "deceive";
  if (["obstruct_investigation", "hide_evidence", "protect_secret"].includes(actionType)) return "investigate";
  if (["manipulate_metric", "accelerate_plan"].includes(actionType)) return "command";
  if (actionType === "influence_npc") return "persuade";
  return actionType as ActionType;
}

function normalizeAgentTarget(target: string, actorId: string, state: WorldState, bible: StoryBible): string {
  const currentLocation = state.locations.find((location) => location.present_characters.includes(actorId));
  const raw = String(target || "");
  if (!raw || raw === "unknown" || raw === "public_situation" || raw === "all_players" || raw === "current_location") {
    return currentLocation?.id || bible.roles.find((role) => role.id === actorId)?.starting_location || raw || "unknown";
  }
  if (raw === "connected_location") {
    return currentLocation?.connected_locations?.[0] || currentLocation?.id || raw;
  }
  const location = state.locations.find((item) => item.id === raw || item.name === raw);
  if (location) return location.id;
  const role = bible.roles.find((item) => item.id === raw || item.name === raw);
  if (role) return role.id;
  const npc = bible.npcs.find((item) => item.id === raw || item.name === raw);
  if (npc) return npc.id;
  const event = bible.events.find((item) => item.id === raw || item.title === raw);
  if (event) return event.id;
  return raw;
}

function inferActionVisibility(action: Pick<StructuredAction, "action_type">): "public" | "partial" | "secret" {
  if (["talk", "persuade", "threaten", "command", "summon_meeting", "duel", "attack"].includes(action.action_type)) {
    return "public";
  }
  if (["eavesdrop", "spy", "steal", "assassinate", "ambush", "deceive"].includes(action.action_type)) {
    return "secret";
  }
  return "partial";
}

function summarizeAIPlayerRoleAction(
  proposal: ActionProposal,
  result: RuleResult,
  bible: StoryBible,
  state: WorldState
): string {
  const visibility = proposal.visibility || "partial";
  const actorName = formatEntityName(proposal.npc_id, bible, state);
  const targetName = formatEntityName(proposal.target, bible, state);
  const label = actionLabel(String(proposal.action_type));

  if (visibility === "public") {
    return `${actorName}公开${label}${targetName ? `了${targetName}` : ""}，${result.success ? "并让局势出现了新的推进。" : "但这次尝试没有完全达到预期。"}`;
  }
  if (visibility === "secret") {
    return `你隐约察觉到${targetName || "某处"}附近似乎有人来过，但看不出是谁，也不知道具体做了什么。`;
  }
  return `${targetName || "某处"}附近出现了可察觉的动静；有人推动了局势，但细节暂时还不清楚。`;
}

function formatEntityName(id: string | undefined, bible: StoryBible, state: WorldState): string {
  if (!id) return "";
  const location = state.locations.find((item) => item.id === id || item.name === id);
  if (location) return location.name;
  const role = bible.roles.find((item) => item.id === id || item.name === id);
  if (role) return role.name;
  const npc = bible.npcs.find((item) => item.id === id || item.name === id);
  if (npc) return npc.name;
  const event = bible.events.find((item) => item.id === id || item.title === id);
  if (event) return event.title;
  return id;
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    talk: "交谈",
    persuade: "说服",
    threaten: "威胁",
    deceive: "欺骗",
    ally: "结盟",
    betray: "背叛",
    confess: "坦白",
    investigate: "调查",
    search: "搜索",
    track: "追踪",
    eavesdrop: "偷听",
    interrogate: "盘问",
    decode: "解读",
    spy: "侦察",
    divination: "占卜",
    gather_intelligence: "收集情报",
    command: "指挥",
    summon_meeting: "召集会议",
    gain_support: "争取支持",
    coup: "夺权",
    impeach: "弹劾",
    appoint: "任命",
    attack: "攻击",
    assassinate: "刺杀",
    duel: "决斗",
    ambush: "伏击",
    defend: "防守",
    execute: "处决",
    sacrifice: "献祭",
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
  };
  return labels[actionType] || actionType;
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
