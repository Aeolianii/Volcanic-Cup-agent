import type {
  StructuredAction,
  RuleResult,
  StateUpdate,
  RollResult,
  Modifier,
  WorldState,
  StoryBible,
  ActionProposal,
} from "@/types";

/**
 * Rule Engine
 * The ONLY entry point for state modification.
 * Every player action and NPC action must pass through here.
 */
export function processPlayerAction(
  action: StructuredAction,
  state: WorldState,
  bible: StoryBible
): RuleResult {
  const updates: StateUpdate[] = [];

  // 1. Permission check
  const permissionCheck = checkPermission(action, state);
  if (!permissionCheck.allowed) {
    return {
      success: false,
      action_id: generateActionId(),
      state_updates: [],
      public_result: permissionCheck.reason,
      private_result: "",
    };
  }

  // 2. Calculate success rate
  const roll = calculateRoll(action, state, bible);

  // 3. Determine outcome
  const success = roll.dice + roll.modifiers.reduce((sum, m) => sum + m.value, 0) >= roll.threshold;

  // 4. Generate state updates based on action
  if (success) {
    generateSuccessUpdates(action, updates, bible);
  } else {
    generateFailureUpdates(action, updates, bible);
  }

  // 5. Build result
  const publicResult = buildPublicResult(action, success);
  const privateResult = buildPrivateResult(action, success, roll);

  return {
    success,
    action_id: generateActionId(),
    state_updates: updates,
    public_result: publicResult,
    private_result: privateResult,
    roll,
  };
}

export function processNPCAction(
  proposal: ActionProposal,
  state: WorldState,
  _bible: StoryBible
): RuleResult {
  const updates: StateUpdate[] = [];

  const roll: RollResult = {
    dice: Math.floor(Math.random() * 100) + 1,
    threshold: 50,
    modifiers: [],
  };

  const success = roll.dice >= roll.threshold;

  if (success) {
    updates.push({
      type: "add_known_fact",
      target: "all_players",
      fact_id: `npc_action_${proposal.npc_id}_${Date.now()}`,
    });
  }

  // NPC actions can affect relationships
  if (proposal.target) {
    updates.push({
      type: "relationship_change",
      target: proposal.target,
      relationship: {
        source: proposal.npc_id,
        target: proposal.target,
        type: "trust",
        delta: success ? 5 : -5,
      },
    });
  }

  return {
    success,
    action_id: generateActionId(),
    state_updates: updates,
    public_result: success
      ? `${proposal.npc_id} 的 ${proposal.intention} 成功了。`
      : `${proposal.npc_id} 的行动未能如愿。`,
    private_result: proposal.reasoning_visible,
    roll,
  };
}

function checkPermission(
  action: StructuredAction,
  _state: WorldState
): { allowed: boolean; reason: string } {
  // For MVP, most actions are allowed
  // Restricted actions that require special conditions
  const restrictedActions = ["coup", "assassinate", "impeach"];

  if (restrictedActions.includes(action.action_type)) {
    if (action.risk_level !== "high") {
      return { allowed: false, reason: "此行动风险极高，需要更多准备。" };
    }
  }

  return { allowed: true, reason: "" };
}

function calculateRoll(
  action: StructuredAction,
  _state: WorldState,
  _bible: StoryBible
): RollResult {
  const dice = Math.floor(Math.random() * 100) + 1;
  const modifiers: Modifier[] = [];

  // Risk-based threshold
  let threshold = 50;
  switch (action.risk_level) {
    case "low":
      threshold = 30;
      modifiers.push({ source: "risk", value: 10, reason: "低风险行动" });
      break;
    case "medium":
      threshold = 50;
      break;
    case "high":
      threshold = 70;
      modifiers.push({ source: "risk", value: -10, reason: "高风险行动" });
      break;
  }

  return { dice, threshold, modifiers };
}

function generateSuccessUpdates(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible
): void {
  // Add knowledge based on action
  updates.push({
    type: "add_known_fact",
    target: action.actor_id,
    fact_id: `action_result_${action.action_type}_${action.target}_${Date.now()}`,
  });

  // Investigation actions yield evidence
  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type)) {
    updates.push({
      type: "add_evidence",
      target: action.actor_id,
      fact_id: `clue_${action.target}_${Date.now()}`,
    });
    updates.push({
      type: "metric_change",
      metric: "truth_progress",
      delta: 10,
    });
  }

  // Social actions affect relationships
  if (["persuade", "ally", "confess"].includes(action.action_type)) {
    if (action.target) {
      updates.push({
        type: "relationship_change",
        target: action.target,
        relationship: {
          source: action.actor_id,
          target: action.target,
          type: "trust",
          delta: 10,
        },
      });
    }
  }

  if (["threaten", "deceive", "betray"].includes(action.action_type)) {
    if (action.target) {
      updates.push({
        type: "relationship_change",
        target: action.target,
        relationship: {
          source: action.actor_id,
          target: action.target,
          type: "trust",
          delta: -15,
        },
      });
      updates.push({
        type: "metric_change",
        metric: findMetricId(bible, ["suspicion", "怀疑"]),
        delta: 10,
      });
    }
  }

  // Location changes
  if (action.method === "stealth_disguise" || action.method === "sneak" || action.method === "infiltrate") {
    updates.push({
      type: "change_location",
      target: action.actor_id,
      value: action.target,
    });
    updates.push({
      type: "set_flag",
      flag: `${action.actor_id}_stealth_mode`,
    });
  }
}

function generateFailureUpdates(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible
): void {
  updates.push({
    type: "metric_change",
    metric: findMetricId(bible, ["suspicion", "怀疑"]),
    delta: 5,
  });

  if (action.risk_level === "high") {
    updates.push({
      type: "metric_change",
      metric: findMetricId(bible, ["political_stability", "situation_stability", "稳定"]),
      delta: -5,
    });
  }

  // Failed stealth exposes the actor
  if (action.method === "stealth_disguise" || action.method === "sneak") {
    updates.push({
      type: "reveal_information",
      target: "all",
      value: `${action.actor_id} 在 ${action.target} 附近被发现。`,
    });
  }
}

function buildPublicResult(action: StructuredAction, success: boolean): string {
  const verb = success ? "成功" : "未能";
  const actionLabels: Record<string, string> = {
    investigate: "调查",
    search: "搜索",
    eavesdrop: "偷听",
    talk: "交谈",
    persuade: "说服",
    threaten: "威胁",
    deceive: "欺骗",
    ally: "结盟",
    betray: "背叛",
    attack: "攻击",
    steal: "偷窃",
    track: "追踪",
    interrogate: "审问",
  };

  const label = actionLabels[action.action_type] || action.action_type;
  return `${action.actor_id} ${verb}${label}了 ${action.target || "目标"}。`;
}

function buildPrivateResult(
  action: StructuredAction,
  success: boolean,
  roll: RollResult
): string {
  const outcome = success ? "成功" : "失败";
  return `[${outcome}] 掷骰: ${roll.dice} | 阈值: ${roll.threshold} | 修正: ${roll.modifiers.map((m) => `${m.reason}(${m.value > 0 ? "+" : ""}${m.value})`).join(", ") || "无"}`;
}

let actionCounter = 0;
function generateActionId(): string {
  actionCounter++;
  return `action_${Date.now()}_${actionCounter}`;
}

function findMetricId(bible: StoryBible, candidates: string[]): string {
  for (const candidate of candidates) {
    const metric = bible.metrics.find(
      (item) => item.id === candidate || item.id.includes(candidate) || item.label.includes(candidate)
    );
    if (metric) return metric.id;
  }
  return candidates[0];
}
