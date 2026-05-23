import type { StructuredAction, ActionType } from "@/types";

/**
 * Action Parser
 * Converts free-form player input into StructuredAction.
 * MVP uses keyword matching; real implementation delegates to AI.
 */
export interface ParsedActionInput {
  action_type: string;
  target: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
}

export function parsePlayerAction(
  rawInput: string,
  actorId: string,
  context?: {
    currentLocation?: string;
    knownFacts?: string[];
  }
): StructuredAction {
  const parsed = keywordParse(rawInput, context);

  // Validate action_type against known types
  const validTypes: ActionType[] = [
    "talk", "persuade", "threaten", "deceive", "ally", "betray", "confess",
    "investigate", "search", "track", "eavesdrop", "interrogate", "decode",
    "command", "summon_meeting", "gain_support", "coup", "impeach", "appoint",
    "attack", "assassinate", "duel", "ambush", "defend",
    "buy", "trade", "steal", "transport", "build",
  ];

  const actionType = validTypes.includes(parsed.action_type as ActionType)
    ? (parsed.action_type as ActionType)
    : "investigate";

  return {
    actor_id: actorId,
    actor_type: "player",
    action_source: "free_action",
    action_type: actionType,
    target: parsed.target || "unknown",
    method: parsed.method || "direct",
    intent: parsed.intent || parsed.action_type,
    risk_level: parsed.risk_level,
    raw_input: rawInput,
  };
}

export function parseSuggestedAction(
  label: string,
  actorId: string,
  suggestion: {
    action_type: string;
    target: string;
    method: string;
    intent: string;
    risk_level: "low" | "medium" | "high";
  }
): StructuredAction {
  return {
    actor_id: actorId,
    actor_type: "player",
    action_source: "suggested_action",
    action_type: suggestion.action_type as ActionType,
    target: suggestion.target,
    method: suggestion.method,
    intent: suggestion.intent,
    risk_level: suggestion.risk_level,
    raw_input: label,
  };
}

export function detectActionInChat(message: string): boolean {
  const actionKeywords = [
    "我要", "我想", "我打算", "我准备", "我去",
    "刺杀", "暗杀", "攻击", "偷", "潜入", "调查",
    "威胁", "贿赂", "说服", "欺骗", "跟踪",
    "拔剑", "动手", "下手",
  ];

  return actionKeywords.some((kw) => message.includes(kw));
}

// ---- Keyword-based parser (MVP - replaced by AI in production) ----

interface KeywordRule {
  keywords: string[];
  action_type: string;
  method?: string;
  intent?: string;
  risk_level: "low" | "medium" | "high";
}

const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ["调查", "查看", "检查", "搜查", "探索"], action_type: "investigate", method: "examine", intent: "investigate", risk_level: "low" },
  { keywords: ["偷听", "窃听", "偷听到", "躲在", "藏起来听"], action_type: "eavesdrop", method: "stealth", intent: "eavesdrop", risk_level: "medium" },
  { keywords: ["跟踪", "尾随", "跟着"], action_type: "track", method: "stealth", intent: "track", risk_level: "medium" },
  { keywords: ["审问", "盘问", "逼问", "拷问"], action_type: "interrogate", method: "interrogation", intent: "interrogate", risk_level: "medium" },
  { keywords: ["说服", "劝说", "劝"], action_type: "persuade", method: "diplomacy", intent: "persuade", risk_level: "low" },
  { keywords: ["威胁", "恐吓", "吓唬"], action_type: "threaten", method: "intimidation", intent: "threaten", risk_level: "medium" },
  { keywords: ["欺骗", "撒谎", "伪装", "假扮", "冒充", "扮成"], action_type: "deceive", method: "disguise", intent: "deceive", risk_level: "high" },
  { keywords: ["结盟", "联手", "合作", "结盟"], action_type: "ally", method: "diplomacy", intent: "ally", risk_level: "low" },
  { keywords: ["背叛", "出卖", "背弃"], action_type: "betray", method: "betrayal", intent: "betray", risk_level: "high" },
  { keywords: ["攻击", "刺杀", "暗杀", "杀"], action_type: "assassinate", method: "attack", intent: "assassinate", risk_level: "high" },
  { keywords: ["决斗", "单挑"], action_type: "duel", method: "combat", intent: "duel", risk_level: "high" },
  { keywords: ["偷", "偷窃", "行窃", "偷取"], action_type: "steal", method: "theft", intent: "steal", risk_level: "high" },
  { keywords: ["收买", "贿赂", "买通"], action_type: "buy", method: "bribery", intent: "gain_information", risk_level: "medium" },
  { keywords: ["交易", "交换"], action_type: "trade", method: "negotiation", intent: "trade", risk_level: "low" },
  { keywords: ["潜入", "潜入", "溜进", "偷偷进入"], action_type: "investigate", method: "stealth_disguise", intent: "infiltrate", risk_level: "high" },
  { keywords: ["召集", "开会", "会议"], action_type: "summon_meeting", method: "authority", intent: "summon_meeting", risk_level: "low" },
  { keywords: ["命令", "下令", "指挥"], action_type: "command", method: "authority", intent: "command", risk_level: "low" },
  { keywords: ["政变", "夺权", "推翻"], action_type: "coup", method: "political", intent: "coup", risk_level: "high" },
  { keywords: ["交谈", "询问", "问", "聊聊", "对话", "告诉"], action_type: "talk", method: "conversation", intent: "talk", risk_level: "low" },
];

// Target extraction patterns
const TARGET_PATTERNS: { pattern: RegExp; location?: string }[] = [
  { pattern: /圣殿/, location: "temple" },
  { pattern: /地下室/, location: "cathedral_basement" },
  { pattern: /地下祭坛|祭坛/, location: "underground_altar" },
  { pattern: /王座大厅|王座/, location: "throne_room" },
  { pattern: /图书馆/, location: "royal_library" },
  { pattern: /酒馆|乌鸦/, location: "tavern" },
  { pattern: /街道|市场/, location: "city_streets" },
  { pattern: /大法师/, location: "archmage" },
  { pattern: /老国王|国王/, location: "old_king" },
  { pattern: /主教/, location: "bishop" },
  { pattern: /王子/, location: "prince" },
  { pattern: /圣女/, location: "saintess" },
  { pattern: /刺客/, location: "assassin" },
  { pattern: /骑士/, location: "knight" },
  { pattern: /守卫/, location: "guard" },
  { pattern: /圣杯/, location: "holy_grail" },
];

function keywordParse(
  input: string,
  context?: { currentLocation?: string; knownFacts?: string[] }
): ParsedActionInput {
  // Find matching rule
  let bestMatch: KeywordRule | null = null;
  let bestScore = 0;

  for (const rule of KEYWORD_RULES) {
    const matchCount = rule.keywords.filter((kw) => input.includes(kw)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = rule;
    }
  }

  // Extract target
  let target = context?.currentLocation || "unknown";
  for (const tp of TARGET_PATTERNS) {
    if (tp.pattern.test(input)) {
      target = tp.location || target;
      break;
    }
  }

  if (bestMatch) {
    return {
      action_type: bestMatch.action_type,
      target,
      method: bestMatch.method || "direct",
      intent: bestMatch.intent || bestMatch.action_type,
      risk_level: bestMatch.risk_level,
    };
  }

  // Default: treat as investigation
  return {
    action_type: "investigate",
    target,
    method: "examine",
    intent: "investigate",
    risk_level: "low",
  };
}
