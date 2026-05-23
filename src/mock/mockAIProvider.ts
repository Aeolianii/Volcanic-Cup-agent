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
import { generateStoryBible } from "@/engine/storyBibleGenerator";

export const mockAIProvider: AIProvider = {
  async generateStoryBible(seed: StorySeed): Promise<StoryBible> {
    return generateStoryBible(seed);
  },

  async generateNarrative(context: GMContext): Promise<GMNarrativeOutput> {
    const { current_turn, current_chapter, story_bible, world_state_summary } = context;
    const eventTitle = story_bible.current_chapter_events[0] || "当前事件";
    const npc = story_bible.npcs[0];
    const setting = story_bible.world_setting || story_bible.title;

    return {
      narration: [
        `**第 ${current_chapter} 章 · 第 ${current_turn} 回合**`,
        current_turn === 0
          ? `${story_bible.title}正式开场。${setting}`
          : `${eventTitle}正在推动局势变化。每个角色的选择都会影响真相、关系和最终结局。`,
        world_state_summary.active_events.length > 0
          ? `当前公开事件：${world_state_summary.active_events.join("、")}`
          : "公开局势仍在酝酿，暂时没有新的公开事件被确认。",
        npc ? `${npc.name}正在观察玩家的反应，可能掌握一部分关键线索。` : "",
      ].filter(Boolean).join("\n\n"),
      suggested_events: current_turn === 0 ? story_bible.current_chapter_events.slice(0, 1) : [],
      revealed_information: [
        {
          type: "fact",
          title: "当前背景",
          content: setting,
          visible_to: ["all"],
        },
      ],
      suggested_actions: buildSuggestedActions(context),
      mood: current_turn === 0 ? "opening" : "tense",
    };
  },

  async generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null> {
    const target = context.local_view.known_players[0]?.id || "all";
    return {
      intention: `${context.npc_goal}，同时试探玩家掌握了多少信息`,
      action_type: "persuade",
      target,
      method: "careful_conversation",
      reasoning_visible: `${context.npc_id}根据自己掌握的有限信息采取了谨慎行动。`,
      risk_level: "low",
    };
  },

  async generateEndingNarrative(context: EndingContext): Promise<string> {
    const metrics = context.world_state_summary.metrics
      .map((metric) => `- ${metric.id}: ${metric.value}`)
      .join("\n");
    return `\n## ${context.ending_title}\n\n关键事件推动故事抵达这一结局。玩家此前的选择改变了真相、关系和局势走向。\n\n${metrics}`;
  },

  async parseAction(input: string, context: ActionParseContext): Promise<ParsedAction> {
    if (/(调查|检查|查看|探索|侦查)/.test(input)) {
      return { action_type: "investigate", target: inferTarget(input, context.current_location), method: "examine", intent: "find_clues", risk_level: "low" };
    }
    if (/(搜索|搜查|翻找|寻找)/.test(input)) {
      return { action_type: "search", target: inferTarget(input, context.current_location), method: "search", intent: "find_clues", risk_level: "low" };
    }
    if (/(偷听|窃听|躲.*听)/.test(input)) {
      return { action_type: "eavesdrop", target: inferTarget(input, context.current_location), method: "stealth", intent: "eavesdrop", risk_level: "high" };
    }
    if (/(潜入|伪装|假扮|溜进)/.test(input)) {
      return { action_type: "investigate", target: inferTarget(input, context.current_location), method: "stealth_disguise", intent: "infiltrate", risk_level: "high" };
    }
    if (/(说服|劝说|游说|安抚)/.test(input)) {
      return { action_type: "persuade", target: inferTarget(input, context.current_location), method: "diplomacy", intent: "persuade", risk_level: "medium" };
    }
    if (/(威胁|恐吓)/.test(input)) {
      return { action_type: "threaten", target: inferTarget(input, context.current_location), method: "intimidation", intent: "threaten", risk_level: "medium" };
    }
    if (/(刺杀|暗杀|杀死|攻击)/.test(input)) {
      return { action_type: "assassinate", target: inferTarget(input, context.current_location), method: "attack", intent: "assassinate", risk_level: "high" };
    }
    if (/(收买|贿赂|购买)/.test(input)) {
      return { action_type: "buy", target: inferTarget(input, context.current_location), method: "bribery", intent: "gain_information", risk_level: "medium" };
    }

    return { action_type: "talk", target: inferTarget(input, context.current_location), method: "conversation", intent: "communicate", risk_level: "low" };
  },
};

function buildSuggestedActions(context: GMContext): GMNarrativeOutput["suggested_actions"] {
  const npc = context.story_bible.npcs[0];
  const activeEvent = context.story_bible.current_chapter_events[0] || "current_thread";
  const actions: GMNarrativeOutput["suggested_actions"] = [
    {
      label: "调查当前线索",
      action_type: "investigate",
      target: activeEvent,
      method: "focused_inquiry",
      intent: "find_clues",
      risk_level: "low",
      context: "围绕当前事件寻找证据和矛盾点",
    },
    {
      label: "整理个人目标",
      action_type: "investigate",
      target: "self_goal",
      method: "reflect",
      intent: "plan_next_move",
      risk_level: "low",
      context: "把公开目标和秘密目标转化为下一步行动",
    },
  ];

  if (npc) {
    actions.push({
      label: `试探${npc.name}`,
      action_type: "talk",
      target: npc.id,
      method: "careful_conversation",
      intent: "gather_information",
      risk_level: "medium",
      context: `${npc.public_identity}，可能掌握局势相关信息`,
    });
  }

  return actions;
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
