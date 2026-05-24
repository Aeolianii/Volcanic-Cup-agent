import type {
  ActionProposal,
  ActionType,
  KnownPlayerAction,
  Modifier,
  RollResult,
  RuleResult,
  StateUpdate,
  StoryBible,
  StructuredAction,
  WorldState,
} from "@/types";
import { getActionCategory } from "@/types";

const INVESTIGATION_ACTIONS: ActionType[] = ["investigate", "search", "track", "eavesdrop", "interrogate", "decode"];
const SOCIAL_ACTIONS: ActionType[] = ["talk", "persuade", "threaten", "deceive", "ally", "betray", "confess"];
const SUCCESS_RATE_FLOOR = 35;

/**
 * Rule Engine
 * The only entry point for state modification. AI can propose actions, but
 * success/failure and state updates are decided here.
 */
export function processPlayerAction(
  action: StructuredAction,
  state: WorldState,
  bible: StoryBible
): RuleResult {
  const updates: StateUpdate[] = [];
  const permissionCheck = checkPermission(action);

  if (!permissionCheck.allowed) {
    return {
      success: false,
      action_id: generateActionId(),
      state_updates: [],
      public_result: permissionCheck.reason,
      private_result: "",
    };
  }

  const roll = calculateRoll(action, state, bible);
  const success = isReflectAction(action) ? true : roll.dice <= roll.threshold;

  if (success) {
    generateSuccessUpdates(action, updates, bible, state);
  } else {
    generateFailureUpdates(action, updates, bible, state);
  }

  rotateActionAdvantage(action, updates, state, success);
  recordVisiblePlayerAction(action, updates, state, bible);

  return {
    success,
    action_id: generateActionId(),
    state_updates: updates,
    public_result: buildPublicResult(action, success, bible, state),
    private_result: buildPrivateResult(success, roll),
    roll,
  };
}

export function processNPCAction(
  proposal: ActionProposal,
  state: WorldState,
  bible: StoryBible
): RuleResult {
  const updates: StateUpdate[] = [];
  const structuredAction = npcProposalToStructuredAction(proposal);
  const roll = calculateNPCRoll(proposal);
  const success = roll.dice <= roll.threshold;

  updates.push({
    type: "update_npc_runtime",
    target: proposal.npc_id,
    npc_runtime: {
      current_intention: proposal.intention,
      action_cooldown: 0,
      intervention_strategy: proposal.action_type,
      last_action_turn: state.turn,
      consecutive_target_id: proposal.target,
      consecutive_target_count:
        state.npc_runtime_state[proposal.npc_id]?.consecutive_target_id === proposal.target
          ? (state.npc_runtime_state[proposal.npc_id]?.consecutive_target_count || 0) + 1
          : 1,
    },
  });
  updates.push({
    type: "append_npc_memory",
    target: proposal.npc_id,
    value: `${state.turn}: ${proposal.action_type} ${proposal.target} ${success ? "approved" : "failed"}`,
    memory: {
      id: `memory_${proposal.npc_id}_${state.turn}_${proposal.action_type}_${Date.now()}`,
      timestamp: state.turn,
      source: "npc_action",
      importance: success ? 70 : 45,
      content: `${structuredAction.actor_id} attempted ${structuredAction.action_type} on ${structuredAction.target}: ${proposal.intention}`,
    },
  });

  if (success) pushNPCActionUpdates(proposal, updates, bible, state);

  return {
    success,
    action_id: generateActionId(),
    state_updates: updates,
    public_result: buildNPCPublicResult(proposal, success, bible, state),
    private_result: proposal.reasoning_visible,
    roll,
  };
}

function checkPermission(action: StructuredAction): { allowed: boolean; reason: string } {
  const restrictedActions = ["coup", "assassinate", "impeach"];
  if (restrictedActions.includes(action.action_type) && action.risk_level !== "high") {
    return { allowed: false, reason: "This action is too risky without a high-risk commitment." };
  }
  return { allowed: true, reason: "" };
}

function npcProposalToStructuredAction(proposal: ActionProposal): StructuredAction {
  const actionType = toRuleActionType(proposal.action_type);
  return {
    actor_id: proposal.npc_id,
    actor_type: "npc",
    action_source: "npc_planner",
    action_type: actionType,
    target: proposal.target,
    method: proposal.method,
    intent: proposal.intention,
    risk_level: proposal.risk_level,
    metadata: {
      npc_action_type: proposal.action_type,
      visibility: proposal.visibility || "partial",
      effect: proposal.effect,
    },
  };
}

function toRuleActionType(actionType: ActionProposal["action_type"]): ActionType {
  if (["obstruct_investigation", "hide_evidence", "protect_secret"].includes(actionType)) return "defend";
  if (["mislead_player", "frame_player"].includes(actionType)) return "deceive";
  if (actionType === "manipulate_metric" || actionType === "accelerate_plan") return "command";
  if (actionType === "influence_npc") return "persuade";
  return actionType as ActionType;
}

function calculateRoll(
  action: StructuredAction,
  state: WorldState,
  bible: StoryBible
): RollResult {
  const dice = Math.floor(Math.random() * 100) + 1;
  const modifiers: Modifier[] = [];
  const category = getActionCategory(action.action_type);

  // Action Resolution Formula:
  // base_success_rate + player_ability_bonus + evidence_bonus +
  // relationship_bonus + world_state_modifier + npc_interference_modifier - risk_penalty.
  modifiers.push({ source: "base_success_rate", value: 50, reason: "base success rate" });
  pushRiskModifier(action, modifiers);
  pushPlayerAbilityModifier(action, bible, modifiers);
  pushEvidenceModifier(action, state, modifiers);
  pushRelationshipModifier(action, state, modifiers);
  pushWorldStateModifier(action, state, bible, modifiers);
  pushActionAdvantageModifiers(action, state, category, modifiers);
  pushNPCInterferenceModifiers(action, state, category, modifiers);

  return {
    dice,
    threshold: clamp(modifiers.reduce((sum, modifier) => sum + modifier.value, 0), SUCCESS_RATE_FLOOR, 95),
    modifiers,
  };
}

function pushRiskModifier(action: StructuredAction, modifiers: Modifier[]): void {
  if (action.risk_level === "low") modifiers.push({ source: "risk_penalty", value: 15, reason: "low risk" });
  if (action.risk_level === "medium") modifiers.push({ source: "risk_penalty", value: 0, reason: "medium risk" });
  if (action.risk_level === "high") modifiers.push({ source: "risk_penalty", value: -15, reason: "high risk" });
}

function pushPlayerAbilityModifier(action: StructuredAction, bible: StoryBible, modifiers: Modifier[]): void {
  const role = bible.roles.find((item) => item.id === action.actor_id);
  if (!role) return;
  const category = getActionCategory(action.action_type);
  if (role.abilities.some((ability) => ability.category === category)) {
    modifiers.push({ source: "player_ability_bonus", value: 10, reason: "matching role ability" });
  }
}

function pushEvidenceModifier(action: StructuredAction, state: WorldState, modifiers: Modifier[]): void {
  if (!INVESTIGATION_ACTIONS.includes(action.action_type)) return;
  const evidenceCount = state.knowledge_state.player_knowledge[action.actor_id]?.evidence.length || 0;
  if (evidenceCount > 0) {
    modifiers.push({ source: "evidence_bonus", value: Math.min(15, evidenceCount * 3), reason: "known evidence" });
  }
}

function pushRelationshipModifier(action: StructuredAction, state: WorldState, modifiers: Modifier[]): void {
  if (!SOCIAL_ACTIONS.includes(action.action_type) || !action.target) return;
  const relationship = state.relationships.find(
    (item) => item.source_id === action.actor_id && item.target_id === action.target && item.type === "trust"
  );
  if (relationship) {
    modifiers.push({
      source: "relationship_bonus",
      value: Math.round(relationship.value / 10),
      reason: "relationship state",
    });
  }
}

function pushWorldStateModifier(
  action: StructuredAction,
  state: WorldState,
  bible: StoryBible,
  modifiers: Modifier[]
): void {
  const pressureMetric = findPressureMetricId(bible);
  const pressure = Number(state.metrics.find((metric) => metric.metric_id === pressureMetric)?.value ?? 0);
  if (pressure >= 70 && action.risk_level === "high") {
    modifiers.push({ source: "world_state_modifier", value: -10, reason: "public pressure is high" });
  }
}

function pushActionAdvantageModifiers(
  action: StructuredAction,
  state: WorldState,
  category: string,
  modifiers: Modifier[]
): void {
  const actorPrefix = `adv_${action.actor_id}_`;
  if (state.flags[`${actorPrefix}momentum`]) {
    modifiers.push({ source: "world_state_modifier", value: 15, reason: "previous momentum" });
  }
  if (state.flags[`${actorPrefix}target_${safeFlagPart(action.target)}`]) {
    modifiers.push({ source: "world_state_modifier", value: 20, reason: "previously focused target" });
  }
  if (state.flags[`${actorPrefix}category_${category}`]) {
    modifiers.push({ source: "world_state_modifier", value: 15, reason: "related previous action" });
  }
}

function pushNPCInterferenceModifiers(
  action: StructuredAction,
  state: WorldState,
  category: string,
  modifiers: Modifier[]
): void {
  for (const modifier of state.active_modifiers || []) {
    if (modifier.target_type !== "action_type") continue;
    if (modifier.target !== action.action_type && modifier.target !== category) continue;
    if (modifier.location && modifier.location !== action.target) continue;
    modifiers.push({
      source: "npc_interference_modifier",
      value: modifier.delta,
      reason: modifier.reason || `NPC modifier from ${modifier.source}`,
    });
  }
}

function calculateNPCRoll(proposal: ActionProposal): RollResult {
  const dice = Math.floor(Math.random() * 100) + 1;
  const modifiers: Modifier[] = [{ source: "base_success_rate", value: 55, reason: "npc base success rate" }];
  if (proposal.risk_level === "low") modifiers.push({ source: "risk_penalty", value: 10, reason: "low risk" });
  if (proposal.risk_level === "high") modifiers.push({ source: "risk_penalty", value: -20, reason: "high risk" });
  if (proposal.requires_rule_check) modifiers.push({ source: "rule_review", value: -5, reason: "requires rule check" });
  return {
    dice,
    threshold: clamp(modifiers.reduce((sum, modifier) => sum + modifier.value, 0), SUCCESS_RATE_FLOOR, 95),
    modifiers,
  };
}

function pushNPCActionUpdates(proposal: ActionProposal, updates: StateUpdate[], bible: StoryBible, state: WorldState): void {
  const effect = proposal.effect;

  if (effect?.type === "success_rate_modifier") {
    updates.push({
      type: "add_active_modifier",
      modifier: {
        id: `modifier_${proposal.npc_id}_${Date.now()}`,
        source: proposal.npc_id,
        target_type: "action_type",
        target: effect.target_action_type || "investigate",
        location: effect.target_location,
        delta: effect.delta ?? -10,
        remaining_turns: Math.max(1, effect.duration_turns ?? 1),
        reason: proposal.reasoning_visible,
      },
    });
    return;
  }

  if (effect?.type === "false_evidence") {
    const evidenceId = effect.evidence_id || `false_evidence_${proposal.npc_id}_${Date.now()}`;
    const targetPlayers = effect.target_player_id && state.knowledge_state.player_knowledge[effect.target_player_id]
      ? [effect.target_player_id]
      : Object.keys(state.knowledge_state.player_knowledge);

    for (const playerId of targetPlayers) {
      updates.push({
        type: "add_evidence",
        target: playerId,
        fact_id: evidenceId,
      });
      updates.push({
        type: "add_known_fact",
        target: playerId,
        fact_id: `Suspicious lead planted by ${proposal.npc_id}: ${proposal.method}`,
      });
    }

    updates.push({
      type: "metric_change",
      metric: effect.metric || findProgressMetricId(bible),
      delta: clamp(effect.delta ?? -5, -10, -1),
    });
    return;
  }

  if (effect?.type === "metric_change" || proposal.action_type === "manipulate_metric" || proposal.action_type === "accelerate_plan") {
    updates.push({
      type: "metric_change",
      metric: effect?.metric || findPressureMetricId(bible),
      delta: effect?.delta ?? 5,
    });
    return;
  }

  if (proposal.action_type === "hide_evidence" || proposal.action_type === "protect_secret") {
    updates.push({
      type: "metric_change",
      metric: findProgressMetricId(bible),
      delta: -5,
    });
    return;
  }

  if (proposal.target || effect?.type === "relationship_change") {
    updates.push({
      type: "relationship_change",
      target: proposal.target,
      relationship: {
        source: proposal.npc_id,
        target: proposal.target,
        type: "trust",
        delta: effect?.delta ?? (proposal.action_type === "mislead_player" || proposal.action_type === "frame_player" ? -8 : 5),
      },
    });
  }
}

function generateSuccessUpdates(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible,
  state: WorldState
): void {
  if (isReflectAction(action)) {
    updates.push({ type: "add_known_fact", target: action.actor_id, fact_id: "You clarified your next priorities." });
    return;
  }

  updates.push({ type: "add_known_fact", target: action.actor_id, fact_id: buildActionFact(action, bible, state) });

  if (INVESTIGATION_ACTIONS.includes(action.action_type)) {
    updates.push({ type: "add_evidence", target: action.actor_id, fact_id: buildEvidenceFact(action, bible, state) });
    pushMetricChange(updates, findProgressMetricId(bible), progressDeltaForAction(action));
  }

  if (["talk", "persuade", "interrogate", "deceive"].includes(action.action_type)) {
    pushMetricChange(updates, findProgressMetricId(bible), bible.npcs.some((npc) => npc.id === action.target) ? 8 : 5);
  }

  if (["persuade", "ally", "confess"].includes(action.action_type) && action.target) {
    pushRelationshipChange(updates, action.actor_id, action.target, 10);
  }

  if (action.action_type === "talk" && action.target) {
    pushRelationshipChange(updates, action.actor_id, action.target, 5);
  }

  if (["threaten", "deceive", "betray"].includes(action.action_type) && action.target) {
    pushRelationshipChange(updates, action.actor_id, action.target, -15);
    pushMetricChange(updates, findPressureMetricId(bible), 10);
  }

  if (action.intent === "stop_ritual" || action.method === "ritual_interruption") {
    updates.push({ type: "set_flag", flag: "ritual_stopped", value: true });
    pushMetricChange(updates, findProgressMetricId(bible), 10);
    pushMetricChange(updates, findPressureMetricId(bible), -20);
    pushMetricChange(updates, findStabilityMetricId(bible), 15);
  }

  if (action.method === "present_evidence" || action.intent === "stabilize_realm") {
    pushMetricChange(updates, findProgressMetricId(bible), 7);
    pushMetricChange(updates, findStabilityMetricId(bible), 15);
  }

  applyGenericStoryProgression(action, updates, bible, state);

  if (["stealth_disguise", "sneak", "infiltrate"].includes(action.method)) {
    updates.push({ type: "change_location", target: action.actor_id, value: action.target });
    updates.push({ type: "set_flag", flag: `${action.actor_id}_stealth_mode`, value: true });
  }
}

function generateFailureUpdates(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible,
  state: WorldState
): void {
  pushMetricChange(updates, findPressureMetricId(bible), 5);
  if (action.risk_level === "high") pushMetricChange(updates, findStabilityMetricId(bible), -5);
  if (["stealth_disguise", "sneak"].includes(action.method)) {
    updates.push({
      type: "reveal_information",
      target: "all",
      value: `${formatEntityName(action.actor_id, bible, state)} was spotted near ${formatEntityName(action.target, bible, state)}.`,
    });
  }
}

function recordVisiblePlayerAction(
  action: StructuredAction,
  updates: StateUpdate[],
  state: WorldState,
  bible: StoryBible
): void {
  if (action.actor_type !== "player" || isReflectAction(action)) return;

  const visibleNPCIds = new Set<string>();
  const actionLocation = state.locations.find((location) =>
    location.id === action.target || location.present_characters.includes(action.actor_id)
  );

  for (const npc of bible.npcs) {
    const samePlace = actionLocation?.present_characters.includes(npc.id);
    const publicOrNoisy = ["talk", "persuade", "threaten", "command", "summon_meeting", "attack", "duel"].includes(action.action_type);
    const targetsNPC = action.target === npc.id;
    const touchesNPCKnowledge = actionCanBeInferredByNPC(action, npc);
    if (samePlace || publicOrNoisy || targetsNPC || touchesNPCKnowledge) visibleNPCIds.add(npc.id);
  }

  const knownAction: KnownPlayerAction = {
    actor_id: action.actor_id,
    action_type: action.action_type,
    target: action.target,
    method: action.method,
    intent: action.intent,
    turn: state.turn,
    public_summary: `${action.actor_id} ${action.action_type} ${action.target}`,
  };

  for (const npcId of visibleNPCIds) {
    updates.push({ type: "record_known_player_action", target: npcId, known_player_action: knownAction });
  }
}

function actionCanBeInferredByNPC(action: StructuredAction, npc: StoryBible["npcs"][number]): boolean {
  if (!INVESTIGATION_ACTIONS.includes(action.action_type)) return false;
  const targetText = action.target.toLowerCase();
  const npcScope = [
    npc.goal,
    npc.secret_goal,
    npc.public_identity,
    npc.initial_knowledge.join(" "),
    npc.memory.join(" "),
  ].join(" ").toLowerCase();
  if (npcScope.includes(targetText)) return true;
  return splitTokens(targetText).some((token) => token.length >= 4 && npcScope.includes(token));
}

function splitTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter(Boolean);
}

function rotateActionAdvantage(
  action: StructuredAction,
  updates: StateUpdate[],
  state: WorldState,
  success: boolean
): void {
  const prefix = `adv_${action.actor_id}_`;
  Object.keys(state.flags)
    .filter((flag) => flag.startsWith(prefix))
    .forEach((flag) => updates.push({ type: "clear_flag", flag }));

  if (!success) return;

  updates.push({ type: "set_flag", flag: `${prefix}momentum`, value: true });
  updates.push({ type: "set_flag", flag: `${prefix}target_${safeFlagPart(action.target)}`, value: true });
  updates.push({ type: "set_flag", flag: `${prefix}category_${getActionCategory(action.action_type)}`, value: true });
  updates.push({ type: "set_flag", flag: `done_${action.actor_id}_${safeFlagPart(actionSignature(action))}`, value: true });

  if (INVESTIGATION_ACTIONS.includes(action.action_type)) {
    updates.push({ type: "set_flag", flag: `${prefix}category_social`, value: true });
    updates.push({ type: "set_flag", flag: `${prefix}category_political`, value: true });
  }
  if (["talk", "persuade", "deceive", "threaten"].includes(action.action_type)) {
    updates.push({ type: "set_flag", flag: `${prefix}category_investigation`, value: true });
  }
}

function applyGenericStoryProgression(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible,
  state: WorldState
): void {
  const category = getActionCategory(action.action_type);
  const text = `${action.action_type} ${action.target} ${action.method} ${action.intent} ${action.raw_input || ""}`.toLowerCase();

  if (category === "social" && /confess|clarify|reconcile|truth|public/.test(text)) {
    pushMetricChange(updates, findProgressMetricId(bible), 10);
    pushMetricChange(updates, findMetricIdOptional(bible, ["trust"]), 10);
    pushMetricChange(updates, findStabilityMetricId(bible), 5);
  }
  if (category === "political" && /support|stabilize|meeting|public|appoint|command/.test(text)) {
    pushMetricChange(updates, findStabilityMetricId(bible), 10);
    pushMetricChange(updates, findPressureMetricId(bible), -5);
  }
  if (category === "resource" && /prepare|secure|build|transport|buy|resource/.test(text)) {
    pushMetricChange(updates, findStabilityMetricId(bible), 6);
    pushMetricChange(updates, findPressureMetricId(bible), -4);
  }
  if (/final|ending|resolve|stop|prevent|complete|confront|expose/.test(text)) {
    pushMetricChange(updates, findProgressMetricId(bible), 10);
    pushMetricsTowardBestEnding(updates, bible, state);
  }
}

function pushMetricsTowardBestEnding(updates: StateUpdate[], bible: StoryBible, state: WorldState): void {
  const ending = [...bible.endings].sort((a, b) => a.priority - b.priority)[0];
  if (!ending) return;

  for (const condition of ending.conditions) {
    if (condition.type !== "metric_threshold" || !condition.metric_id) continue;
    const current = Number(state.metrics.find((metric) => metric.metric_id === condition.metric_id)?.value ?? 0);
    const target = Number(condition.value);
    if (!Number.isFinite(current) || !Number.isFinite(target)) continue;
    if (condition.operator === "gte" && current < target) {
      pushMetricChange(updates, condition.metric_id, Math.min(15, Math.max(5, target - current)));
    }
    if (condition.operator === "lte" && current > target) {
      pushMetricChange(updates, condition.metric_id, -Math.min(15, Math.max(5, current - target)));
    }
  }
}

function buildPublicResult(action: StructuredAction, success: boolean, bible: StoryBible, state: WorldState): string {
  const actorName = formatEntityName(action.actor_id, bible, state);
  const targetName = formatEntityName(action.target, bible, state);
  if (isReflectAction(action)) return `${actorName} clarified their priorities.`;
  return `${actorName} ${success ? "succeeded" : "failed"} with ${action.action_type} against ${targetName}.`;
}

function buildNPCPublicResult(proposal: ActionProposal, success: boolean, bible: StoryBible, state: WorldState): string {
  if (proposal.visibility === "secret") {
    return success ? "World pressure shifts quietly in the background." : "A hidden move fails to take hold.";
  }
  if (proposal.visibility === "partial") {
    return success
      ? `Someone changed the situation: ${proposal.intention}`
      : "Someone attempted to change the situation, but the effect did not last.";
  }
  return `${formatEntityName(proposal.npc_id, bible, state)} ${success ? "acted" : "failed to act"}: ${proposal.intention}`;
}

function buildPrivateResult(success: boolean, roll: RollResult): string {
  const modifiers = roll.modifiers.map((item) => `${item.source}:${item.value}`).join(", ") || "none";
  return `[${success ? "success" : "failure"}] roll=${roll.dice}, success_rate=${roll.threshold}, modifiers=${modifiers}`;
}

function buildActionFact(action: StructuredAction, bible: StoryBible, state: WorldState): string {
  const targetName = formatEntityName(action.target, bible, state);
  if (INVESTIGATION_ACTIONS.includes(action.action_type)) {
    return `你在${targetName}完成了一次调查，获得了可继续追踪的新发现。`;
  }
  if (SOCIAL_ACTIONS.includes(action.action_type)) {
    return `你与${targetName}的互动改变了当前关系与局势。`;
  }
  return `你围绕${targetName}采取了行动，局势因此产生变化。`;
}

function buildEvidenceFact(action: StructuredAction, bible: StoryBible, state: WorldState): string {
  return `来自${formatEntityName(action.target, bible, state)}的线索：现场出现了值得继续核对的异常细节。`;
}

function progressDeltaForAction(action: StructuredAction): number {
  if (["eavesdrop", "decode", "interrogate"].includes(action.action_type)) return 20;
  if (["search", "track"].includes(action.action_type)) return 15;
  if (["prioritize_clues", "cross_check_statement", "evidence_confrontation", "broaden_search"].includes(action.method)) return 15;
  return 12;
}

function pushRelationshipChange(updates: StateUpdate[], source: string, target: string, delta: number): void {
  updates.push({
    type: "relationship_change",
    target,
    relationship: { source, target, type: "trust", delta },
  });
}

function pushMetricChange(updates: StateUpdate[], metric: string | undefined, delta: number): void {
  if (!metric || delta === 0) return;
  updates.push({ type: "metric_change", metric, delta });
}

function findMetricIdOptional(bible: StoryBible, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const metric = bible.metrics.find((item) => {
      const haystack = `${item.id} ${item.label}`.toLowerCase();
      return item.id === candidate || haystack.includes(candidate.toLowerCase());
    });
    if (metric) return metric.id;
  }
  return undefined;
}

function findProgressMetricId(bible: StoryBible): string | undefined {
  return findMetricIdOptional(bible, ["truth_progress", "progress", "truth", "clue", "evidence"]);
}

function findStabilityMetricId(bible: StoryBible): string | undefined {
  return findMetricIdOptional(bible, ["kingdom_stability", "situation_stability", "political_stability", "stability", "order", "safety"]);
}

function findPressureMetricId(bible: StoryBible): string | undefined {
  return findMetricIdOptional(bible, ["holy_grail_influence", "supernatural_pressure", "faction_power", "suspicion", "pressure", "influence", "power", "tension"]);
}

function isReflectAction(action: StructuredAction): boolean {
  return action.target === "self_goal" || action.method === "reflect" || action.intent === "plan_next_move";
}

function formatEntityName(id: string | undefined, bible: StoryBible, state?: WorldState): string {
  if (!id) return "target";
  if (id === "unknown") return "unknown target";
  if (id === "all" || id === "all_players") return "all players";
  if (id === "self_goal") return "personal goal";

  const role = bible.roles.find((item) => item.id === id || item.name === id);
  if (role) return role.name;
  const npc = bible.npcs.find((item) => item.id === id || item.name === id);
  if (npc) return npc.name;
  const faction = bible.factions.find((item) => item.id === id || item.name === id);
  if (faction) return faction.name;
  const location = state?.locations.find((item) => item.id === id || item.name === id);
  if (location) return location.name;
  const event = bible.events.find((item) => item.id === id || item.title === id);
  if (event) return event.title;
  const metric = bible.metrics.find((item) => item.id === id || item.label === id);
  if (metric) return metric.label;
  return id.replace(/^npc_/, "").replace(/^role_/, "").replace(/_/g, " ");
}

function safeFlagPart(value: string | undefined): string {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_]/g, "_");
}

function actionSignature(action: StructuredAction): string {
  return [action.action_type, action.target, action.method, action.intent]
    .map((value) => String(value || "").toLowerCase())
    .join("|");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

let actionCounter = 0;
function generateActionId(): string {
  actionCounter += 1;
  return `action_${Date.now()}_${actionCounter}`;
}
