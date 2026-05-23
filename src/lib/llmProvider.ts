import type {
  ActionParseContext,
  AIProvider,
  EndingContext,
  GMContext,
  GMNarrativeOutput,
  NPCActionOutput,
  NPCContext,
  ParsedAction,
  StoryBible,
  StorySeed,
} from "@/types";
import { mockAIProvider } from "@/mock/mockAIProvider";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-pro";

function getConfig() {
  return {
    apiKey:
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_COMPAT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseUrl:
      process.env.DEEPSEEK_BASE_URL ||
      process.env.OPENAI_COMPAT_BASE_URL ||
      DEFAULT_BASE_URL,
    model:
      process.env.DEEPSEEK_MODEL ||
      process.env.OPENAI_COMPAT_MODEL ||
      DEFAULT_MODEL,
  };
}

async function chatJSON<T>(messages: ChatMessage[], fallback: T, maxTokens = 1200): Promise<T> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) return fallback;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;

    return parseJSON<T>(content, fallback);
  } catch {
    return fallback;
  }
}

function parseJSON<T>(content: string, fallback: T): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = (fenced || content).trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace
    ? raw.slice(firstBrace, lastBrace + 1)
    : raw;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return fallback;
  }
}

function systemJSON(task: string): ChatMessage {
  return {
    role: "system",
    content: [
      "你是 AI Story Foundry 的叙事与规则协作模型。",
      "必须只输出合法 JSON，不要 Markdown，不要解释。",
      "所有内容必须基于当前 Story Bible、角色视角和 World State。",
      "禁止输出占位文本、内部 ID、未提供的固定模板设定。",
      "禁止把其他故事的圣杯、国王、王座、宫廷、空间站等模板硬套进当前故事。",
      "如果当前故事是校园或言情设定，NPC、地点、行动建议必须使用校园/关系语境，不得出现国王、贵族、王座、骑士等不属于设定的元素。",
      task,
    ].join("\n"),
  };
}

export const llmAIProvider: AIProvider = {
  async generateStoryBible(seed: StorySeed): Promise<StoryBible> {
    return mockAIProvider.generateStoryBible(seed);
  },

  async generateNarrative(context: GMContext): Promise<GMNarrativeOutput> {
    const fallback = await mockAIProvider.generateNarrative(context);
    return chatJSON<GMNarrativeOutput>(
      [
        systemJSON(
          "生成 GM 叙事。AI GM 可以读取摘要，但不能修改 World State。输出字段必须为 narration, suggested_events, revealed_information, suggested_actions, mood。suggested_actions 每项必须含 label, action_type, target, method, intent, risk_level, context。推荐行动必须贴合当前设定，不能把当前玩家自己当作社交目标。"
        ),
        { role: "user", content: JSON.stringify(context) },
      ],
      fallback,
      1800
    );
  },

  async generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null> {
    const fallback = await mockAIProvider.generateNPCAction(context);
    return chatJSON<NPCActionOutput | null>(
      [
        systemJSON(
          "基于 NPC 的有限局部视野生成一个 NPC 行动提案。严禁使用未提供的完整 Story Bible、隐藏结局、未来章节或其他角色秘密。输出字段必须为 intention, action_type, target, method, reasoning_visible, risk_level。"
        ),
        { role: "user", content: JSON.stringify(context) },
      ],
      fallback,
      800
    );
  },

  async generateEndingNarrative(context: EndingContext): Promise<string> {
    const fallback = await mockAIProvider.generateEndingNarrative(context);
    const output = await chatJSON<{ narrative: string }>(
      [
        systemJSON("生成结局叙事。输出 JSON：{\"narrative\":\"...\"}。"),
        { role: "user", content: JSON.stringify(context) },
      ],
      { narrative: fallback },
      1400
    );
    return output.narrative || fallback;
  },

  async parseAction(input: string, context: ActionParseContext): Promise<ParsedAction> {
    const fallback = localParseAction(input, context);
    return chatJSON<ParsedAction>(
      [
        systemJSON(
          "把玩家自然语言行动解析为 StructuredAction 的核心字段。action_type 只能从 talk,persuade,threaten,deceive,ally,betray,confess,investigate,search,track,eavesdrop,interrogate,decode,command,summon_meeting,gain_support,coup,impeach,appoint,attack,assassinate,duel,ambush,defend,buy,trade,steal,transport,build 中选择。risk_level 只能是 low, medium, high。输出字段必须为 action_type,target,method,intent,risk_level。"
        ),
        { role: "user", content: JSON.stringify({ input, context }) },
      ],
      fallback,
      500
    );
  },
};

function localParseAction(input: string, context: ActionParseContext): ParsedAction {
  const target = inferTarget(input, context.current_location);

  if (/(调查|检查|查看|探索|侦查)/.test(input)) {
    return { action_type: "investigate", target, method: "examine", intent: "find_clues", risk_level: "low" };
  }
  if (/(搜索|搜查|翻找|寻找)/.test(input)) {
    return { action_type: "search", target, method: "search", intent: "find_clues", risk_level: "low" };
  }
  if (/(偷听|窃听|躲.*听)/.test(input)) {
    return { action_type: "eavesdrop", target, method: "stealth", intent: "eavesdrop", risk_level: "high" };
  }
  if (/(潜入|伪装|假扮|溜进)/.test(input)) {
    return { action_type: "investigate", target, method: "stealth_disguise", intent: "infiltrate", risk_level: "high" };
  }
  if (/(说服|劝说|游说|安抚)/.test(input)) {
    return { action_type: "persuade", target, method: "diplomacy", intent: "persuade", risk_level: "medium" };
  }
  if (/(威胁|恐吓)/.test(input)) {
    return { action_type: "threaten", target, method: "intimidation", intent: "threaten", risk_level: "medium" };
  }
  if (/(刺杀|暗杀|杀死|攻击)/.test(input)) {
    return { action_type: "assassinate", target, method: "attack", intent: "assassinate", risk_level: "high" };
  }
  if (/(收买|贿赂|购买)/.test(input)) {
    return { action_type: "buy", target, method: "bribery", intent: "gain_information", risk_level: "medium" };
  }

  return { action_type: "talk", target, method: "conversation", intent: "communicate", risk_level: "low" };
}

function inferTarget(input: string, currentLocation: string): string {
  const targets: Array<[RegExp, string]> = [
    [/教室|班级/, "classroom"],
    [/学生会|办公室/, "student_council_room"],
    [/图书馆/, "library"],
    [/社团|活动室/, "club_room"],
    [/操场/, "sports_field"],
    [/食堂/, "cafeteria"],
    [/走廊/, "corridor"],
    [/实验室/, "research_lab"],
    [/指挥|甲板/, "command_deck"],
    [/档案|资料/, "archive"],
    [/会面|约定/, "meeting_place"],
    [/角落/, "quiet_corner"],
  ];

  return targets.find(([pattern]) => pattern.test(input))?.[1] || currentLocation || "current_location";
}
