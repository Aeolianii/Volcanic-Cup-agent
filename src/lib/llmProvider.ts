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
import { buildAgentSkillSystemPrompt } from "@/agents/agentSkills";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-pro";

function getConfig() {
  return {
    apiKey:
      process.env.OPENAI_COMPAT_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseUrl:
      process.env.OPENAI_COMPAT_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      DEFAULT_BASE_URL,
    model:
      process.env.OPENAI_COMPAT_MODEL ||
      process.env.DEEPSEEK_MODEL ||
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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`LLM request failed: ${response.status} ${errorText.slice(0, 400)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;

    return parseJSON(content, fallback);
  } catch (error) {
    console.error("[LLM Provider] chatJSON fallback", {
      error: error instanceof Error ? error.message : String(error),
      baseUrl,
      model,
    });
    return fallback;
  }
}

export function applyRequestLLMConfig(headers: Headers): void {
  const apiKey = headers.get("x-llm-api-key")?.trim();
  const baseUrl = headers.get("x-llm-base-url")?.trim();
  const model = headers.get("x-llm-model")?.trim();
  if (apiKey) process.env.OPENAI_COMPAT_API_KEY = apiKey;
  if (baseUrl) process.env.OPENAI_COMPAT_BASE_URL = baseUrl;
  if (model) process.env.OPENAI_COMPAT_MODEL = model;
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
      "You are an AI helper for AI Story Foundry.",
      "Return valid JSON only. Do not use Markdown.",
      "Do not invent world facts outside the provided context.",
      task,
    ].join("\n"),
  };
}

function buildCleanNarrativeFallback(context: GMContext): GMNarrativeOutput {
  const title = context.story_bible.title || "当前故事";
  const round = context.current_round || context.current_turn || 1;
  const chapter = context.current_chapter || 1;
  const metricLine = (context.last_action?.metric_changes || [])
    .filter((item) => typeof item.before !== "undefined" && typeof item.after !== "undefined")
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.before} -> ${item.after}${typeof item.delta === "number" ? `（${item.delta >= 0 ? "+" : ""}${item.delta}）` : ""}`)
    .join("；");
  const activeEvent = context.world_state_summary.active_events[0] ||
    context.progression_guidance?.next_events?.[0]?.title ||
    "当前场景";
  const roles = context.story_bible.roles.slice(0, 4);
  const firstRole = roles[0]?.name || "关键角色";
  const secondRole = roles[1]?.name || "另一位角色";
  const profile = String(context.runtime_modules?.genre_profile || context.story_bible.genre_profile || "");
  const isRelationship = /romance|relationship|campus/.test(profile);
  const isMystery = /mystery|investigation/.test(profile);

  const narrationParts = [
    `第 ${chapter} 章 · 第 ${round} 回合。`,
    isRelationship
      ? `${title}的局面被这次选择轻轻推开了一道缝。人物之间的态度、记忆和未说出口的话，正在成为下一步的真正压力。`
      : isMystery
        ? `${title}的线索链被推进了一步。新的证词与旧痕迹开始互相校验，真相仍需要继续拆解。`
        : `${title}的局势出现新的推进。公开选择会改变资源、立场与接下来可触发的事件。`,
  ];
  if (metricLine) narrationParts.push(`数值变化：${metricLine}。`);
  if (context.last_action?.public_result) narrationParts.push(context.last_action.public_result);

  const suggested_actions = isRelationship
    ? [
        action(`试探${firstRole}的真实态度`, "talk", roles[0]?.id || activeEvent, "careful_conversation", "clarify_feelings", "推动真心归位或继续保留误会"),
        action(`向${secondRole}核对一段记忆`, "persuade", roles[1]?.id || activeEvent, "memory_crosscheck", "verify_memory", "推动记忆归位，也可能暴露新的情感矛盾"),
        action("公开回应今晚的选择", "confess", activeEvent, "public_response", "shift_group_consensus", "把关系推向坦白、逃避或错付的不同结局方向"),
      ]
    : isMystery
      ? [
          action("复核最矛盾的证词", "investigate", activeEvent, "cross_check_testimony", "advance_truth", "提高真相破解度并改变嫌疑分布"),
          action(`单独询问${firstRole}`, "interrogate", roles[0]?.id || activeEvent, "targeted_questioning", "test_suspicion", "推动嫌疑值变化，也可能解锁私聊线索"),
          action("搜索核心场景遗漏物", "search", activeEvent, "scene_sweep", "find_evidence", "提升探索度并补全证据链"),
        ]
      : [
          action("争取公开支持", "gain_support", activeEvent, "public_positioning", "improve_position", "推动己方优势但可能引发反制"),
          action(`试探${firstRole}的立场`, "persuade", roles[0]?.id || activeEvent, "private_negotiation", "shift_alliance", "改变关系或阵营走向"),
          action("处理当前危机节点", "command", activeEvent, "decisive_order", "advance_event_chain", "推进章节事件并改变局势指标"),
        ];

  return {
    narration: narrationParts.join("\n\n"),
    suggested_events: [],
    revealed_information: [],
    suggested_actions,
    mood: isRelationship ? "intimate" : isMystery ? "tense" : "strategic",
  };
}

function action(
  label: string,
  action_type: string,
  target: string,
  method: string,
  intent: string,
  context: string
): GMNarrativeOutput["suggested_actions"][number] {
  return {
    label,
    action_type,
    target,
    method,
    intent,
    risk_level: "medium",
    context,
  };
}

export const llmAIProvider: AIProvider = {
  async generateStoryBible(seed: StorySeed): Promise<StoryBible> {
    return mockAIProvider.generateStoryBible(seed);
  },

  async generateNarrative(context: GMContext): Promise<GMNarrativeOutput> {
    const fallback = buildCleanNarrativeFallback(context);
    return chatJSON<GMNarrativeOutput>(
      [
        systemJSON(
          [
            buildAgentSkillSystemPrompt("gm-narrative-skill"),
            "Generate a concise GM narrative from the provided Story Bible summary and World State summary.",
            "Match the genre and tone. Romance/relationship stories should focus on memory, trust, hesitation, affection, confession, regret, and choices; do not use war, faction, dark-current, rule-discovery, or conspiracy wording unless the story context explicitly contains it.",
            "Do not expose internal IDs such as player_123, npc_1, role_2, metric ids, flag names, JSON keys, or raw imported script text.",
            "If last_action.metric_changes is present, include the exact before -> after values for visible metrics and explain why the changes are continuous and logical.",
            "Every suggested action must be concrete and playable now. It must name a visible role, event, place, relationship, clue, metric, or ending direction from the context.",
            "Do not output vague template actions such as 调查当前线索, 调查当前疑点, 整理个人目标, 推进关系线, or 寻找关键见证者 unless you replace them with the actual target and consequence.",
            "Provide 3 to 5 suggested_actions. Make them push the story toward different possible ending directions.",
            "Required fields: narration, suggested_events, revealed_information, suggested_actions, mood.",
          ].join("\n")
        ),
        { role: "user", content: JSON.stringify(context) },
      ],
      fallback,
      1600
    );
  },

  async generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null> {
    return chatJSON<NPCActionOutput | null>(
      [
        {
          role: "system",
          content: [
            buildAgentSkillSystemPrompt("npc-agent-designer"),
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
