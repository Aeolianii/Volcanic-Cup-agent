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

export async function generateRandomStorySeedWithLLM(): Promise<LLMResult<{
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  character_details: string;
  world_setting: string;
  inspiration_title: string;
}>> {
  const fallback = buildLocalRandomStorySeed();
  return chatJSONWithStatus(
    [
      systemJSON([
        "你是互动剧本和多人跑团式叙事游戏设计师。",
        "请随机生成一个适合多人互动、包含秘密、冲突、调查或关系博弈的原创故事种子。",
        "故事必须能直接填入创建故事页面的 6 个输入框。",
        "必须返回 JSON，字段为：genre, opening, ending, characters, character_details, world_setting, inspiration_title。",
        "characters 要列出 3-5 个主要可玩人物。",
        "character_details 要包含每个人的性格、公开目标、秘密目标、人物间关系和冲突。",
        "opening 要有明确开局事件；ending 要给出可达成的结局方向；world_setting 要说明地点、规则、氛围和限制。",
        "不要使用内部 ID，不要输出 Markdown。",
      ].join("\n")),
      {
        role: "user",
        content: JSON.stringify({
          request: "随机生成一个原创互动故事，并填充创建故事页面的六个字段。",
          preferred_language: "中文",
        }),
      },
    ],
    fallback,
    1800
  );
}

function buildLocalRandomStorySeed() {
  const samples = [
    {
      inspiration_title: "雨夜旧书店",
      genre: "都市悬疑 / 关系博弈",
      opening: "暴雨切断了老城区的交通，四名陌生人被困在一家即将拆迁的旧书店里。午夜时，店主失踪，柜台上只剩一本写着众人秘密的旧账册。越详细，生成的剧本会越精彩。",
      ending: "玩家可以选择公开账册真相、共同掩盖某个秘密，或找出真正操纵旧书店事件的人。越详细，生成的剧本会越精彩。",
      characters: "沈澈、林遥、周牧、许青岚",
      character_details: [
        "沈澈：冷静的前记者，公开目标是查清店主失踪真相，秘密目标是找回当年被自己压下的报道证据。",
        "林遥：敏感的插画师，公开目标是安全离开书店，秘密目标是销毁账册中关于姐姐的记录。",
        "周牧：圆滑的地产顾问，公开目标是维持局面，秘密目标是拿到拆迁合同的关键把柄。",
        "许青岚：旧书店常客，公开目标是保护书店遗物，秘密目标是证明店主曾经背叛过自己。",
        "关系冲突：沈澈和周牧互相怀疑，林遥与许青岚都知道店主的一部分过去，但两人掌握的真相互相矛盾。",
      ].join("\n"),
      world_setting: "故事发生在暴雨封锁的老城区旧书店。手机信号不稳定，外界救援要到天亮才会抵达；书店里的旧账册、夹页、录音磁带和墙后暗格会逐步揭露人物秘密。",
    },
    {
      inspiration_title: "雪山温泉旅馆",
      genre: "封闭空间推理 / 民宿悬疑",
      opening: "雪崩封住了下山道路，温泉旅馆的所有住客被迫滞留。晚餐后，一位住客声称在浴场看见了三年前失踪者的影子，随后旅馆老板的保险柜被打开，里面的旧照片不翼而飞。越详细，生成的剧本会越精彩。",
      ending: "玩家需要决定是揭开三年前失踪案、保护仍活着的相关者，还是利用真相换取自己想要的未来。越详细，生成的剧本会越精彩。",
      characters: "旅馆继承人、摄影师、失踪者妹妹、退休刑警、神秘常客",
      character_details: [
        "旅馆继承人：表面温和，公开目标是安抚住客，秘密目标是隐藏父亲留下的旧债。",
        "摄影师：善于观察，公开目标是记录异常现象，秘密目标是找到能让自己翻身的独家证据。",
        "失踪者妹妹：固执直接，公开目标是查清姐姐下落，秘密目标是确认某位住客是否参与隐瞒。",
        "退休刑警：沉默谨慎，公开目标是维持秩序，秘密目标是弥补当年办案失误。",
        "神秘常客：行踪古怪，公开目标是等待道路恢复，秘密目标是取走藏在旅馆里的遗物。",
      ].join("\n"),
      world_setting: "旅馆位于雪山深处，暴雪期间无法离开。旅馆包含温泉浴场、旧仓库、员工宿舍、观景台和封锁的旧客房；每晚会出现新的线索或误导信息。",
    },
  ];
  return samples[Math.floor(Math.random() * samples.length)];
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
