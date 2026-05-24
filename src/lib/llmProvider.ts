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

type LLMResult<T> = {
  ok: boolean;
  value: T;
  reason?: string;
  model?: string;
  baseUrl?: string;
};

async function chatJSONWithStatus<T>(messages: ChatMessage[], fallback: T, maxTokens = 1200): Promise<LLMResult<T>> {
  const { apiKey, baseUrl, model } = getConfig();
  const publicStatus = { model, baseUrl };
  if (!apiKey) {
    return {
      ok: false,
      value: fallback,
      reason: "未配置大模型 API Key。请在 .env.local 中设置 DEEPSEEK_API_KEY 或 OPENAI_COMPAT_API_KEY。",
      ...publicStatus,
    };
  }

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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        value: fallback,
        reason: `大模型 API 请求失败：HTTP ${response.status}${errorText ? ` - ${errorText.slice(0, 240)}` : ""}`,
        ...publicStatus,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return {
        ok: false,
        value: fallback,
        reason: "大模型 API 返回中没有 choices[0].message.content。",
        ...publicStatus,
      };
    }

    const parsed = parseJSONWithStatus(content, fallback);
    return {
      ok: parsed.ok,
      value: parsed.value,
      reason: parsed.ok ? undefined : parsed.reason,
      ...publicStatus,
    };
  } catch (error) {
    return {
      ok: false,
      value: fallback,
      reason: `大模型 API 调用异常：${String(error)}`,
      ...publicStatus,
    };
  }
}

async function chatJSON<T>(messages: ChatMessage[], fallback: T, maxTokens = 1200): Promise<T> {
  return (await chatJSONWithStatus(messages, fallback, maxTokens)).value;
}

function parseJSONWithStatus<T>(content: string, fallback: T): { ok: boolean; value: T; reason?: string } {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = (fenced || content).trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace
    ? raw.slice(firstBrace, lastBrace + 1)
    : raw;

  try {
    return { ok: true, value: JSON.parse(jsonText) as T };
  } catch (error) {
    return {
      ok: false,
      value: fallback,
      reason: `大模型返回内容不是合法 JSON：${String(error)}；原始内容片段：${raw.slice(0, 240)}`,
    };
  }
}

function parseJSON<T>(content: string, fallback: T): T {
  return parseJSONWithStatus(content, fallback).value;
}

function systemJSON(task: string): ChatMessage {
  return {
    role: "system",
    content: [
      "You are an AI helper for AI Story Foundry.",
      "Return valid JSON only. Do not use Markdown.",
      "Do not invent world facts outside the provided context.",
      task,
    ].join("\n"),
  };
}

export async function enhanceStorySeedWithLLM(input: {
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  character_details: string;
  world_setting: string;
  playability_score?: number;
  suggested_fixes?: string[];
}): Promise<LLMResult<{
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  character_details: string;
  world_setting: string;
  improvement_summary: string[];
}>> {
  const fallback = buildLocalEnhancedStorySeed(input);
  return chatJSONWithStatus(
    [
      systemJSON([
        "你是互动剧本和多人跑团式叙事游戏设计师。",
        "用户的可玩性分析得分较低，你需要在不推翻原始创意的前提下完善剧本和人设。",
        "重点补强：人物性格、公开目标、秘密目标、人物间关系、核心冲突、可调查线索、世界观约束。",
        "必须返回 JSON，字段为：genre, opening, ending, characters, character_details, world_setting, improvement_summary。",
        "opening 和 ending 要更具体，但不要写成长篇小说；characters 要列出可玩人物；character_details 要写人物性格、目标、秘密、冲突和关系。",
      ].join("\n")),
      { role: "user", content: JSON.stringify(input) },
    ],
    fallback,
    1800
  );
}

function buildLocalEnhancedStorySeed(input: {
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  character_details: string;
  world_setting: string;
  suggested_fixes?: string[];
}) {
  const genre = input.genre || "悬疑互动剧本";
  const opening = input.opening || "一场看似普通的聚会突然被意外打断，所有人都被迫留在现场等待真相浮出水面。";
  const ending = input.ending || "玩家通过调查、谈判和互相试探，揭开核心秘密，并决定真相公开、私下和解或让某人承担代价。";
  const characters = input.characters || "调查者、知情者、隐瞒秘密的人、被牵连的旁观者";
  const characterDetails = input.character_details || [
    "调查者：外表冷静，公开目标是查清真相，秘密目标是证明自己的判断没有错。",
    "知情者：谨慎回避冲突，公开目标是配合调查，秘密目标是隐藏与事件有关的旧关系。",
    "隐瞒秘密的人：擅长转移话题，公开目标是维持秩序，秘密目标是销毁对自己不利的证据。",
    "旁观者：容易被情绪影响，公开目标是自保，秘密目标是利用信息差换取安全。",
  ].join("\n");
  const worldSetting = input.world_setting || "故事发生在封闭空间中，外部支援暂时无法进入；每个人掌握的信息都不完整，公开线索和私人秘密会逐步推动局势升级。";

  return {
    genre,
    opening: `${opening}\n补强：开场应尽快制造一个必须立刻处理的事件，并给每个角色一个必须行动的理由。`,
    ending: `${ending}\n补强：结局应由真相揭露程度、关键人物信任度和玩家是否公开秘密共同决定。`,
    characters,
    character_details: characterDetails,
    world_setting: worldSetting,
    improvement_summary: input.suggested_fixes?.length
      ? input.suggested_fixes.slice(0, 4)
      : ["补充人物目标与秘密", "强化人物间冲突", "增加可调查线索", "明确结局判定方向"],
  };
}

export const llmAIProvider: AIProvider = {
  async generateStoryBible(seed: StorySeed): Promise<StoryBible> {
    return mockAIProvider.generateStoryBible(seed);
  },

  async generateNarrative(context: GMContext): Promise<GMNarrativeOutput> {
    const fallback = await mockAIProvider.generateNarrative(context);
    const result = await chatJSONWithStatus<GMNarrativeOutput>(
      [
        systemJSON(
          "Generate a concise GM narrative from the provided Story Bible summary and World State summary. The GM can narrate and suggest actions, but cannot modify World State. Required fields: narration, suggested_events, revealed_information, suggested_actions, mood."
        ),
        { role: "user", content: JSON.stringify(context) },
      ],
      fallback,
      1600
    );

    return {
      ...result.value,
      provider_status: result.ok
        ? {
            provider: "llm",
            ok: true,
            model: result.model,
            base_url: result.baseUrl,
          }
        : {
            provider: "fallback",
            ok: false,
            reason: result.reason,
            model: result.model,
            base_url: result.baseUrl,
          },
    };
  },

  async generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null> {
    return chatJSON<NPCActionOutput | null>(
      [
        {
          role: "system",
          content: [
            "You are one independent NPC agent in a multiplayer story game.",
            "You must role-play ONLY this NPC. You do not know the full Story Bible, ending conditions, future events, hidden truth, private player actions, or other NPC secrets.",
            "Your entire available knowledge is the JSON user payload: your own goal, your own secret_goal, and local_view.",
            "Use the NPC goal hierarchy in this order: core goal > current stage goal > immediate turn intention.",
            "local_view.runtime contains persistent memory, current_goal, current_plan, relationships, threat_targets, protected_secrets, and past target streaks. Future planning must reference memory when relevant.",
            "local_view.visible_metrics are the only World State metrics you may reason about. local_view.recent_actions and local_view.observations are the only player/world actions you may react to.",
            "First observe, then assess threat, then choose an intention, then generate one action proposal.",
            "Generate one NPC action that advances your goal or protects your secret. It may help, mislead, obstruct, test, threaten, exploit, or cooperate with players.",
            "Fairness: do not target the same player forever; if consecutive_target_count >= 2 for the same target, choose another target or a world/public target. Do not permanently delete critical clues. Maximize story tension, not player failure.",
            "If a visible truth/progress metric is >= 70 and protecting your goal/secret requires it, you may fabricate false evidence: action_type='mislead_player', method='fabricate_false_evidence', effect.type='false_evidence', effect.metric=<that visible metric id>, effect.delta between -1 and -10.",
            "If a known player investigation threatens your goal/secret, you may obstruct it with effect.type='success_rate_modifier', target_action_type matching the known action, target_location matching the known action target, and a negative delta.",
            "Do not directly decide success or failure. Rule Engine will audit your proposal.",
            "Return valid JSON only with fields: intention, action_type, target, method, reasoning_visible, risk_level, visibility, effect.",
            "Allowed NPC action_type values include: obstruct_investigation, mislead_player, hide_evidence, frame_player, manipulate_metric, influence_npc, protect_secret, accelerate_plan, talk, persuade, threaten.",
            "Allowed effect.type values: success_rate_modifier, metric_change, relationship_change, false_evidence, none.",
            "visibility must be public, partial, or secret.",
          ].join("\n"),
        },
        { role: "user", content: JSON.stringify(context) },
      ],
      null,
      1000
    );
  },

  async generateEndingNarrative(context: EndingContext): Promise<string> {
    const fallback = await mockAIProvider.generateEndingNarrative(context);
    const output = await chatJSON<{ narrative: string }>(
      [
        systemJSON("Generate an ending narrative. Required JSON: {\"narrative\":\"...\"}."),
        { role: "user", content: JSON.stringify(context) },
      ],
      { narrative: fallback },
      1200
    );
    return output.narrative || fallback;
  },

  async parseAction(input: string, context: ActionParseContext): Promise<ParsedAction> {
    const fallback = localParseAction(input, context);
    return chatJSON<ParsedAction>(
      [
        systemJSON(
          "Parse the player's natural-language action into JSON fields: action_type, target, method, intent, risk_level. action_type must be one of talk,persuade,threaten,deceive,ally,betray,confess,investigate,search,track,eavesdrop,interrogate,decode,spy,divination,gather_intelligence,command,summon_meeting,gain_support,coup,impeach,appoint,attack,assassinate,duel,ambush,defend,execute,sacrifice,buy,trade,steal,transport,build. If runtime_modules.disabled_action_types contains an action, avoid returning it and choose a genre-appropriate social/investigation alternative. risk_level must be low, medium, or high."
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
  const text = input.toLowerCase();
  const disabledActions = new Set(context.runtime_modules?.disabled_action_types || []);

  if (/调查|检查|查看|探索|侦查|investigate|inspect|examine/.test(text)) {
    return { action_type: "investigate", target, method: "examine", intent: "find_clues", risk_level: "low" };
  }
  if (/搜索|搜查|寻找|search|find/.test(text)) {
    return { action_type: "search", target, method: "search", intent: "find_clues", risk_level: "low" };
  }
  if (/偷听|窃听|eavesdrop|listen/.test(text)) {
    return { action_type: "eavesdrop", target, method: "stealth", intent: "eavesdrop", risk_level: "high" };
  }
  if (/潜入|伪装|sneak|infiltrate/.test(text)) {
    return { action_type: "investigate", target, method: "stealth_disguise", intent: "infiltrate", risk_level: "high" };
  }
  if (/说服|劝说|persuade/.test(text)) {
    return { action_type: "persuade", target, method: "diplomacy", intent: "persuade", risk_level: "medium" };
  }
  if (/威胁|恐吓|threaten|intimidate/.test(text)) {
    return { action_type: "threaten", target, method: "intimidation", intent: "threaten", risk_level: "medium" };
  }
  if (/刺杀|暗杀|攻击|assassinate|attack/.test(text) && !disabledActions.has("assassinate")) {
    return { action_type: "assassinate", target, method: "attack", intent: "assassinate", risk_level: "high" };
  }
  if (/刺杀|暗杀|攻击|assassinate|attack/.test(text)) {
    const mode = context.runtime_modules?.consequence_mode;
    if (mode === "comic_setback") {
      return { action_type: "deceive", target, method: "comic_escalation", intent: "create_comic_setback", risk_level: "medium" };
    }
    return { action_type: "threaten", target, method: "genre_safe_conflict", intent: "force_confrontation", risk_level: "medium" };
  }
  if (/收买|贿赂|buy|bribe/.test(text)) {
    return { action_type: "buy", target, method: "bribery", intent: "gain_information", risk_level: "medium" };
  }

  return { action_type: "talk", target, method: "conversation", intent: "communicate", risk_level: "low" };
}

function inferTarget(input: string, currentLocation: string): string {
  const targets: Array<[RegExp, string]> = [
    [/教室|班级|classroom/i, "classroom"],
    [/学生会|student council/i, "student_council_room"],
    [/图书馆|library/i, "library"],
    [/社团|club/i, "club_room"],
    [/操场|sports/i, "sports_field"],
    [/食堂|cafeteria/i, "cafeteria"],
    [/走廊|corridor/i, "corridor"],
    [/圣殿|神殿|temple/i, "temple"],
    [/地下室|basement/i, "cathedral_basement"],
    [/祭坛|altar/i, "underground_altar"],
    [/王座|大厅|throne/i, "throne_room"],
    [/图书|档案|archive|records/i, "archive"],
    [/大法师|archmage/i, "npc_archmage"],
    [/国王|old king|king/i, "npc_old_king"],
    [/主教|bishop/i, "npc_bishop"],
    [/实验室|lab/i, "research_lab"],
    [/指挥|甲板|command/i, "command_deck"],
    [/会面|约定|meeting/i, "meeting_place"],
    [/角落|corner/i, "quiet_corner"],
  ];

  return targets.find(([pattern]) => pattern.test(input))?.[1] || currentLocation || "current_location";
}
