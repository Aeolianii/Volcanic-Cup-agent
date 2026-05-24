import type { AIProvider, ActionProposal, NPC, NPCActionEffect, NPCActionType, NPCLocalView } from "@/types";

const MAX_CONSECUTIVE_TARGET = 2;

/**
 * NPC Planner
 *
 * Each NPC is planned as an independent agent. The AI receives only the NPC's
 * own profile plus NPCLocalView. It never receives the full Story Bible.
 */
export async function generateNPCActionProposal(
  npc: NPC,
  localView: NPCLocalView,
  aiProvider: AIProvider,
  options: { actorKind?: "fixed_npc" | "ai_player_role" } = {}
): Promise<ActionProposal> {
  try {
    const aiOutput = await aiProvider.generateNPCAction({
      npc_id: npc.id,
      npc_name: npc.name,
      npc_personality: npc.personality,
      npc_goal: npc.goal,
      npc_secret_goal: npc.secret_goal,
      local_view: localView,
    });

    if (aiOutput) {
      return normalizeProposal({
        npc_id: npc.id,
        intention: aiOutput.intention,
        action_type: normalizeNPCActionType(aiOutput.action_type, options.actorKind),
        target: aiOutput.target,
        method: aiOutput.method,
        reasoning_visible: aiOutput.reasoning_visible,
        risk_level: aiOutput.risk_level,
        visibility: aiOutput.visibility || "partial",
        requires_rule_check: true,
        effect: aiOutput.effect,
      }, localView, options);
    }
  } catch {
    // Fall through to deterministic local behavior.
  }

  if (options.actorKind === "ai_player_role") {
    return playerRoleBehavioralPlanner(npc, localView);
  }
  return behavioralPlanner(npc, localView);
}

function behavioralPlanner(npc: NPC, localView: NPCLocalView): ActionProposal {
  const progressMetricId = visibleMetricId(localView, progressMetricCandidates());
  const influenceMetricId = visibleMetricId(localView, influenceMetricCandidates()) || firstNumericVisibleMetric(localView);
  const truthProgress = progressMetricId ? visibleMetricValue(localView, progressMetricCandidates()) : 0;
  const topThreat = localView.threat_assessment[0];
  const threateningInvestigation = findThreateningInvestigation(npc, localView);
  const targetPlayer = fairTarget(topThreat?.target_id || mostRecentKnownPlayer(localView), localView);

  if (progressMetricId && truthProgress >= 70 && npc.behavior_style.deception >= 50) {
    return {
      npc_id: npc.id,
      intention: `保护核心目标，制造假证据误导接近真相的调查`,
      action_type: "mislead_player",
      target: targetPlayer || "all_players",
      method: "fabricate_false_evidence",
      reasoning_visible: `${npc.name}根据自己的记忆、可见指标和威胁评估，判断局势已经危险，决定制造可疑但不致命的误导。`,
      risk_level: npc.behavior_style.caution >= 70 ? "medium" : "high",
      visibility: "partial",
      requires_rule_check: true,
      effect: {
        type: "false_evidence",
        target_player_id: targetPlayer,
        evidence_id: `false_evidence_${npc.id}_${Date.now()}`,
        metric: progressMetricId,
        delta: -6,
        duration_turns: 0,
      },
    };
  }

  if (threateningInvestigation && (topThreat?.level || 0) >= 45) {
    return {
      npc_id: npc.id,
      intention: `保护阶段目标，延缓 ${threateningInvestigation.target} 的调查`,
      action_type: "obstruct_investigation",
      target: threateningInvestigation.target,
      method: npc.behavior_style.deception >= 60 ? "misdirection_and_interference" : "direct_pressure",
      reasoning_visible: `${npc.name}只知道玩家正在接近敏感地点或线索，因此尝试延缓调查，而不是永久删除关键线索。`,
      risk_level: npc.behavior_style.caution >= 70 ? "low" : "medium",
      visibility: "partial",
      requires_rule_check: true,
      effect: {
        type: "success_rate_modifier",
        target_action_type: threateningInvestigation.action_type,
        target_location: threateningInvestigation.target,
        delta: npc.behavior_style.deception >= 70 ? -20 : -15,
        duration_turns: 1,
      },
    };
  }

  if (topThreat && topThreat.level >= 55 && targetPlayer) {
    return {
      npc_id: npc.id,
      intention: `调查威胁目标 ${targetPlayer}，确认其掌握的信息`,
      action_type: "influence_npc",
      target: targetPlayer,
      method: "probe_and_recruit",
      reasoning_visible: `${npc.name}没有全局真相，只能通过试探威胁目标来判断下一步。`,
      risk_level: "medium",
      visibility: "secret",
      requires_rule_check: true,
      effect: {
        type: "relationship_change",
        delta: -5,
      },
    };
  }

  if (npc.behavior_style.deception > 50 && localView.known_players.length > 0) {
    const target = fairTarget(localView.known_players[0].id, localView) || "public_situation";
    return {
      npc_id: npc.id,
      intention: `用选择性真相制造张力，同时保护自己的秘密`,
      action_type: "mislead_player",
      target,
      method: "selective_truth",
      reasoning_visible: `${npc.name}基于有限知识释放半真半假的信息，让局势更紧张。`,
      risk_level: "medium",
      visibility: "partial",
      requires_rule_check: true,
      effect: {
        type: "success_rate_modifier",
        target_action_type: "investigate",
        delta: -10,
        duration_turns: 1,
      },
    };
  }

  return {
    npc_id: npc.id,
    intention: `推进核心目标：${localView.runtime.core_goal || npc.goal}`,
    action_type: "accelerate_plan",
    target: "public_situation",
    method: "quiet_preparation",
    reasoning_visible: `${npc.name}没有发现直接威胁，于是推进自己的计划。`,
    risk_level: "low",
    visibility: "secret",
    requires_rule_check: true,
    effect: {
      type: "metric_change",
      metric: influenceMetricId,
      delta: 3,
      duration_turns: 0,
    },
  };
}

function playerRoleBehavioralPlanner(npc: NPC, localView: NPCLocalView): ActionProposal {
  const currentLocation = localView.known_players[0]?.location || "current_location";
  const topThreat = localView.threat_assessment[0];
  const targetPlayer = fairTarget(topThreat?.target_id || mostRecentKnownPlayer(localView), localView);

  if (topThreat && topThreat.level >= 55 && targetPlayer) {
    return {
      npc_id: npc.id,
      intention: `试探${targetPlayer}掌握了多少信息，并判断是否需要合作或误导`,
      action_type: npc.behavior_style.deception >= npc.behavior_style.cooperation ? "deceive" : "persuade",
      target: targetPlayer,
      method: npc.behavior_style.deception >= npc.behavior_style.cooperation ? "selective_truth" : "careful_conversation",
      reasoning_visible: `${npc.name}作为 AI 代管角色，只根据自己可见的信息和角色目标行动。`,
      risk_level: "medium",
      visibility: npc.behavior_style.deception >= npc.behavior_style.cooperation ? "secret" : "public",
      requires_rule_check: true,
    };
  }

  if (npc.behavior_style.caution >= 60 || npc.behavior_style.deception >= 60) {
    return {
      npc_id: npc.id,
      intention: "调查当前局势中最可疑的地点，同时避免过早暴露自己的真实目标",
      action_type: "investigate",
      target: currentLocation,
      method: "careful_search",
      reasoning_visible: `${npc.name}优先推进自己的公开/秘密目标，而不是替固定 NPC 干预玩家。`,
      risk_level: "low",
      visibility: "partial",
      requires_rule_check: true,
    };
  }

  return {
    npc_id: npc.id,
    intention: "公开推动自己的角色目标，并寻找可以结盟的人",
    action_type: npc.behavior_style.cooperation >= 60 ? "persuade" : "investigate",
    target: targetPlayer || currentLocation,
    method: npc.behavior_style.cooperation >= 60 ? "open_negotiation" : "direct_inquiry",
    reasoning_visible: `${npc.name}作为缺席玩家的替代行动体，选择像玩家一样推动角色目标。`,
    risk_level: "low",
    visibility: npc.behavior_style.cooperation >= 60 ? "public" : "partial",
    requires_rule_check: true,
  };
}

function normalizeProposal(
  proposal: ActionProposal,
  localView: NPCLocalView,
  options: { actorKind?: "fixed_npc" | "ai_player_role" } = {}
): ActionProposal {
  const effect = normalizeEffect(proposal.effect, localView);
  return {
    ...proposal,
    action_type: normalizeNPCActionType(proposal.action_type, options.actorKind),
    target: fairTarget(proposal.target, localView) || proposal.target || mostRecentKnownPlayer(localView) || "public_situation",
    method: proposal.method || "indirect_action",
    reasoning_visible: proposal.reasoning_visible || "NPC acts from limited local knowledge.",
    risk_level: proposal.risk_level || "medium",
    visibility: proposal.visibility || "partial",
    requires_rule_check: true,
    effect,
  };
}

function normalizeEffect(effect: NPCActionEffect | undefined, localView: NPCLocalView): NPCActionEffect | undefined {
  if (!effect) return undefined;
  if (effect.type === "false_evidence") {
    const progressMetricId = visibleMetricId(localView, progressMetricCandidates());
    return {
      ...effect,
      metric: progressMetricId || effect.metric,
      delta: clamp(effect.delta ?? -5, -10, -1),
    };
  }
  if (effect.type === "success_rate_modifier") {
    return {
      ...effect,
      delta: clamp(effect.delta ?? -10, -30, -1),
      duration_turns: Math.max(1, effect.duration_turns ?? 1),
    };
  }
  return effect;
}

const NPC_ACTION_TYPES: NPCActionType[] = [
  "obstruct_investigation",
  "mislead_player",
  "hide_evidence",
  "frame_player",
  "manipulate_metric",
  "influence_npc",
  "protect_secret",
  "accelerate_plan",
  "talk",
  "persuade",
  "threaten",
  "deceive",
  "ally",
  "betray",
  "confess",
  "investigate",
  "search",
  "track",
  "eavesdrop",
  "interrogate",
  "decode",
  "command",
  "summon_meeting",
  "gain_support",
  "coup",
  "impeach",
  "appoint",
  "attack",
  "assassinate",
  "duel",
  "ambush",
  "defend",
  "buy",
  "trade",
  "steal",
  "transport",
  "build",
];

function normalizeNPCActionType(value: string, actorKind?: "fixed_npc" | "ai_player_role"): NPCActionType {
  if (actorKind === "ai_player_role") {
    const playerRoleMap: Record<string, NPCActionType> = {
      obstruct_investigation: "investigate",
      mislead_player: "deceive",
      hide_evidence: "investigate",
      frame_player: "deceive",
      manipulate_metric: "command",
      influence_npc: "persuade",
      protect_secret: "investigate",
      accelerate_plan: "investigate",
    };
    if (playerRoleMap[value]) return playerRoleMap[value];
  }
  return NPC_ACTION_TYPES.includes(value as NPCActionType)
    ? (value as NPCActionType)
    : actorKind === "ai_player_role" ? "investigate" : "mislead_player";
}

function findThreateningInvestigation(npc: NPC, localView: NPCLocalView) {
  const goalText = [
    npc.goal,
    npc.secret_goal,
    localView.runtime.core_goal,
    localView.runtime.current_goal,
    localView.runtime.protected_secrets.join(" "),
    localView.known_facts.join(" "),
  ].join(" ").toLowerCase();

  return localView.recent_actions
    .filter((action) => ["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type))
    .find((action) => {
      const targetText = action.target.toLowerCase();
      const targetTokens = splitTokens(targetText);
      return (
        goalText.includes(targetText) ||
        targetTokens.some((token) => token.length >= 4 && goalText.includes(token)) ||
        genericSensitiveTarget(action.target)
      );
    });
}

function fairTarget(target: string | undefined, localView: NPCLocalView): string | undefined {
  if (!target) return undefined;
  if (
    localView.runtime.consecutive_target_id === target &&
    (localView.runtime.consecutive_target_count || 0) >= MAX_CONSECUTIVE_TARGET
  ) {
    return localView.threat_assessment.find((item) => item.target_id !== target)?.target_id ||
      localView.known_players.find((player) => player.id !== target)?.id;
  }
  return target;
}

function visibleMetricValue(localView: NPCLocalView, candidates: string[]): number {
  const id = visibleMetricId(localView, candidates);
  const metric = localView.visible_metrics.find((item) => item.id === id);
  return Number(metric?.value ?? 0);
}

function visibleMetricId(localView: NPCLocalView, candidates: string[]): string | undefined {
  return localView.visible_metrics.find((metric) =>
    candidates.some((candidate) => metric.id.toLowerCase().includes(candidate.toLowerCase()))
  )?.id;
}

function firstNumericVisibleMetric(localView: NPCLocalView): string | undefined {
  return localView.visible_metrics.find((metric) => Number.isFinite(Number(metric.value)))?.id;
}

function progressMetricCandidates(): string[] {
  return [
    "truth_progress",
    "progress",
    "truth",
    "clue",
    "evidence",
    "investigation",
    "discovery",
    "真相",
    "进度",
    "线索",
    "证据",
    "调查",
    "发现",
  ];
}

function influenceMetricCandidates(): string[] {
  return [
    "faction_power",
    "influence",
    "power",
    "pressure",
    "tension",
    "suspicion",
    "stability",
    "trust",
    "势力",
    "影响",
    "压力",
    "紧张",
    "怀疑",
    "稳定",
    "信任",
  ];
}

function splitTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter(Boolean);
}

function genericSensitiveTarget(target: string): boolean {
  return /(secret|clue|evidence|record|archive|witness|investigation|hidden|秘密|线索|证据|记录|档案|证人|调查|隐藏)/i.test(target);
}

function mostRecentKnownPlayer(localView: NPCLocalView): string | undefined {
  return localView.recent_actions.at(-1)?.actor_id || localView.known_players[0]?.id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
