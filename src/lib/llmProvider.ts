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

async function chatJSONStrict<T>(messages: ChatMessage[], maxTokens = 1200): Promise<T> {
  return requestJSONStrict<T>(messages, maxTokens, {
    temperature: 0.75,
    responseFormat: true,
  });
}

type StrictRequestOptions = {
  temperature: number;
  responseFormat: boolean;
  signal?: AbortSignal;
};

async function requestJSONStrict<T>(
  messages: ChatMessage[],
  maxTokens = 1200,
  options: StrictRequestOptions
): Promise<T> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) throw new Error("Missing AI API key");

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
      temperature: options.temperature,
      ...(options.responseFormat ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: options.signal,
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM response is empty");

  return parseJSONStrict<T>(content);
}

async function chatJSONStrictRace<T>(messages: ChatMessage[], maxTokens = 1400): Promise<T> {
  const attempts = [
    { temperature: 0.72, responseFormat: true, maxTokens },
    { temperature: 0.82, responseFormat: false, maxTokens: Math.max(maxTokens, 1500) },
  ];
  const controllers = attempts.map(() => new AbortController());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let pending = attempts.length;
    const errors: string[] = [];

    attempts.forEach((attempt, index) => {
      requestJSONStrict<T>(messages, attempt.maxTokens, {
        temperature: attempt.temperature,
        responseFormat: attempt.responseFormat,
        signal: controllers[index].signal,
      })
        .then((value) => {
          if (settled) return;
          settled = true;
          controllers.forEach((controller, controllerIndex) => {
            if (controllerIndex !== index) controller.abort();
          });
          resolve(value);
        })
        .catch((error) => {
          if (settled) return;
          errors.push(String(error));
          pending -= 1;
          if (pending === 0) {
            reject(new Error(`All LLM race attempts failed: ${errors.join(" | ")}`));
          }
        });
    });
  });
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

function parseJSONStrict<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = (fenced || content).trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace
    ? raw.slice(firstBrace, lastBrace + 1)
    : raw;

  return JSON.parse(jsonText) as T;
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
    if (context.last_action) {
      return chatJSONStrictRace<GMNarrativeOutput>(
        [
          {
            role: "system",
            content: [
              "你是互动叙事游戏的 AI GM。只输出合法 JSON。",
              "根据玩家上一行动、规则结算结果和当前 World State 写主叙事。",
              "必须具体写出行动造成的反馈、目标人物或地点的回应、获得的信息、局势变化。",
              "last_action.implicit_effects 是隐藏/条件指标造成的模糊体感变化，可以自然融入叙事。",
              "禁止写出隐藏指标名称、内部 key 或具体数值；例如不要写“怀疑值上升5”，要写“你的举动引起了一些人的怀疑”。",
              "不要只说成功或失败，不要输出内部 id，不要编入当前 Story Bible 之外的题材模板。",
              "JSON 字段必须是 narration, suggested_events, revealed_information, suggested_actions, mood。",
              "suggested_actions 必须结合当前 World State、上一行动结果、已触发事件和角色处境生成 3 到 5 个新的下一步行动。",
              "suggested_actions 不得重复上一行动，不得使用与当前剧情无关的本地模板。",
              "narration 用中文，控制在 180 到 320 字。",
            ].join("\n"),
          },
          { role: "user", content: JSON.stringify(compactActionNarrativeContext(context)) },
        ],
        1400
      );
    }

    const messages: ChatMessage[] = [
      systemJSON(
        "生成 GM 叙事。AI GM 可以读取摘要，但不能修改 World State。输出字段必须为 narration, suggested_events, revealed_information, suggested_actions, mood。suggested_actions 每项必须含 label, action_type, target, method, intent, risk_level, context。推荐行动必须基于当前 Story Bible、World State、当前章节、公开事件和角色处境生成，不能把当前玩家自己当作社交目标，不能输出与当前剧情无关的固定模板。"
      ),
      { role: "user", content: JSON.stringify(context) },
    ];

    return chatJSONStrict<GMNarrativeOutput>(messages, 1800);
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

function compactActionNarrativeContext(context: GMContext) {
  const lastAction = context.last_action;
  return {
    story: {
      title: context.story_bible.title,
      world_setting: context.story_bible.world_setting,
      npcs: context.story_bible.npcs,
      roles: context.story_bible.roles,
      current_chapter_events: context.story_bible.current_chapter_events,
    },
    world_state: {
      turn: context.current_turn,
      chapter: context.current_chapter,
      active_events: context.world_state_summary.active_events,
      metrics: context.world_state_summary.metrics,
      flags: context.world_state_summary.flags,
    },
    last_action: lastAction
      ? {
          actor_name: lastAction.actor_name,
          action_label: lastAction.action_label,
          action_type: lastAction.action_type,
          target_name: lastAction.target_name,
          method: lastAction.method,
          intent: lastAction.intent,
          risk_level: lastAction.risk_level,
          raw_input: lastAction.raw_input,
          success: lastAction.success,
          rule_public_result: lastAction.public_result,
          implicit_effects: lastAction.implicit_effects || [],
          state_updates: lastAction.state_updates,
          triggered_events: lastAction.triggered_events,
        }
      : null,
  };
}

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
    [/圣殿|神殿/, "temple"],
    [/地下室|教堂地下室/, "cathedral_basement"],
    [/祭坛/, "underground_altar"],
    [/大法师/, "npc_archmage"],
    [/国王|老国王/, "npc_old_king"],
    [/主教/, "npc_bishop"],
    [/守卫/, "guard"],
  ];

  return targets.find(([pattern]) => pattern.test(input))?.[1] || currentLocation || "current_location";
}
