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
  const success = isReflectAction(action)
    ? true
    : roll.dice + roll.modifiers.reduce((sum, m) => sum + m.value, 0) >= roll.threshold;

  // 4. Generate state updates based on action
  if (success) {
    generateSuccessUpdates(action, updates, bible);
  } else {
    generateFailureUpdates(action, updates, bible, state);
  }

  // 5. Build result
  const publicResult = buildPublicResult(action, success, bible, state);
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
  bible: StoryBible
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
      ? `${formatEntityName(proposal.npc_id, bible, state)}的行动产生了效果：${proposal.intention}`
      : `${formatEntityName(proposal.npc_id, bible, state)}尝试行动，但没有达到预期。`,
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
  if (isReflectAction(action)) {
    updates.push({
      type: "add_known_fact",
      target: action.actor_id,
      fact_id: "你重新梳理了自己的公开目标、秘密目标与当前局势，明确了下一步行动优先级。",
    });
    return;
  }

  // Add knowledge based on action
  updates.push({
    type: "add_known_fact",
    target: action.actor_id,
    fact_id: buildActionFact(action, bible),
  });

  // Investigation actions yield evidence
  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type)) {
    updates.push({
      type: "add_evidence",
      target: action.actor_id,
      fact_id: buildEvidenceFact(action, bible),
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

  if (action.action_type === "talk" && action.target) {
    updates.push({
      type: "relationship_change",
      target: action.target,
      relationship: {
        source: action.actor_id,
        target: action.target,
        type: "trust",
        delta: 5,
      },
    });
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

function buildActionFact(action: StructuredAction, bible: StoryBible): string {
  const targetName = formatEntityName(action.target, bible);

  if (isReflectAction(action)) {
    return "你重新梳理了自己的公开目标、秘密目标与当前局势，明确了下一步行动优先级。";
  }

  if (action.action_type === "talk") {
    const npc = bible.npcs.find((item) => item.id === action.target || item.name === targetName);
    if (npc?.id.includes("archmage") || npc?.name.includes("大法师")) {
      return "大法师暗示：圣杯失窃时，圣殿魔力潮汐与守夜记录同时异常，普通窃贼很难做到这一点。";
    }
    if (npc?.id.includes("bishop") || npc?.name.includes("主教")) {
      return "主教承认圣殿昨夜临时封锁过内殿，但回避了封锁的真正原因。";
    }
    return `你完成了一次交谈：${targetName}给出了可继续追问的回应。`;
  }

  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type)) {
    return `你在${targetName}获得了新的线索，后续可以围绕时间线、证词和异常痕迹继续推进。`;
  }

  return `你完成了一次${actionLabel(action.action_type)}：${targetName}的态度或局势因此发生变化。`;
}

function buildEvidenceFact(action: StructuredAction, bible: StoryBible): string {
  const targetName = formatEntityName(action.target, bible);
  if (targetName.includes("圣殿") || targetName.includes("圣杯")) {
    return "线索：圣殿记录中存在一段无法解释的空白，和圣杯失窃时间高度重合。";
  }
  return `线索：${targetName}留下了与当前事件相关的异常细节。`;
}

function generateFailureUpdates(
  action: StructuredAction,
  updates: StateUpdate[],
  bible: StoryBible,
  state?: WorldState
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
      value: `${formatEntityName(action.actor_id, bible, state)}在${formatEntityName(action.target, bible, state)}附近被发现。`,
    });
  }
}

function buildPublicResult(
  action: StructuredAction,
  success: boolean,
  bible: StoryBible,
  state: WorldState
): string {
  const actorName = formatEntityName(action.actor_id, bible, state);
  const targetName = formatEntityName(action.target, bible, state);
  const verb = success ? "成功" : "没能";
  const actionLabels: Record<string, string> = {
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
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
    social: "互动",
    political: "周旋",
    investigation: "调查",
    combat: "对抗",
    resource: "调配资源",
  };

  const label = actionLabels[action.action_type] || action.action_type;
  if (isReflectAction(action)) {
    return success
      ? `${actorName}完成了目标梳理。`
      : `${actorName}暂时没能理清下一步目标。`;
  }

  if (!action.target || action.target === "self_goal" || action.target === "unknown") {
    return `${actorName}${verb}${label}。`;
  }

  const socialActions = new Set([
    "talk",
    "persuade",
    "threaten",
    "deceive",
    "ally",
    "betray",
    "confess",
    "social",
  ]);

  if (socialActions.has(action.action_type)) {
    return `${actorName}${verb}与${targetName}进行${label}。`;
  }

  return `${actorName}${verb}对${targetName}进行${label}。`;
}

function actionLabel(actionType: string): string {
  const actionLabels: Record<string, string> = {
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
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
    social: "互动",
    political: "周旋",
    investigation: "调查",
    combat: "对抗",
    resource: "调配资源",
  };
  return actionLabels[actionType] || actionType;
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

function isReflectAction(action: StructuredAction): boolean {
  return action.target === "self_goal" || action.method === "reflect" || action.intent === "plan_next_move";
}

function formatEntityName(id: string | undefined, bible: StoryBible, state?: WorldState): string {
  if (!id) return "目标";
  if (id === "unknown") return "当前目标";
  if (id === "all" || id === "all_players") return "所有人";
  if (id === "self_goal") return "自己的目标";

  const knownLabels: Record<string, string> = {
    current_location: "当前位置",
    "current location": "当前位置",
    connected_location: "相关地点",
    "connected location": "相关地点",
    current_event: "当前事件",
    "current event": "当前事件",
    informed_npc: "知情者",
    "informed npc": "知情者",
    witness: "证人",
    guard: "守卫",
    "self goal": "自己的目标",
    archmage: "大法师",
    old_king: "老国王",
    bishop: "主教",
    prince: "王子",
    saintess: "圣女",
    assassin: "刺客",
    knight: "骑士",
    holy_grail: "圣杯",
  };
  if (knownLabels[id]) return knownLabels[id];

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

  if (/^player_/.test(id)) return "玩家";
  return id.replace(/^npc_/, "").replace(/^role_/, "").replace(/_/g, " ");
}
