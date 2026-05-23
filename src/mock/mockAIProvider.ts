import type {
  AIProvider,
  GMContext,
  GMNarrativeOutput,
  NPCContext,
  NPCActionOutput,
  ActionParseContext,
  ParsedAction,
  EndingContext,
  StoryBible,
  StorySeed,
} from "@/types";
import { DEMO_STORY_BIBLE } from "./demoStoryBible";

/**
 * Mock AI Provider
 * Returns deterministic template-based outputs.
 * Interface is ready for replacement with real LLM calls.
 */
export const mockAIProvider: AIProvider = {
  async generateStoryBible(_seed: StorySeed): Promise<StoryBible> {
    // For MVP, always return the demo bible
    return { ...DEMO_STORY_BIBLE, id: `story_${Date.now()}` };
  },

  async generateNarrative(context: GMContext): Promise<GMNarrativeOutput> {
    const { current_turn, current_chapter, story_bible } = context;

    if (current_turn === 0) {
      return {
        narration: `**第 ${current_chapter} 章**\n\n夜幕降临在艾尔德兰王国。\n\n${story_bible.world_setting}\n\n月圆之夜，圣殿的钟声响起——圣杯失踪了。\n\n各方势力开始在圣殿聚集。王室的继承者、教会的神职人员、隐藏在暗处的刺客、忠诚的骑士...每个人都有自己的目的，每个人都隐藏着秘密。\n\n圣杯的失落只是开始。真正的游戏，现在才刚刚开始。`,
        suggested_events: ["holy_grail_stolen"],
        revealed_information: [
          {
            type: "fact",
            title: "圣杯失踪",
            content: "圣殿中的圣杯在月圆之夜离奇失踪，没有留下任何痕迹。",
            visible_to: ["all"],
          },
        ],
        suggested_actions: [
          { label: "调查圣殿", action_type: "investigate", target: "temple", method: "examine", intent: "investigate", risk_level: "low", context: "圣杯失踪的地点" },
          { label: "询问守卫", action_type: "talk", target: "guard", method: "conversation", intent: "gather_information", risk_level: "low", context: "守卫是最后见过圣杯的人" },
          { label: "查看案发现场", action_type: "search", target: "temple", method: "examine", intent: "find_clues", risk_level: "low", context: "可能遗留下关键线索" },
        ],
        mood: "mysterious",
      };
    }

    if (current_turn <= 2) {
      return {
        narration: `调查开始了。圣殿中弥漫着不安的气息。\n\n每个人都在观察，每个人都在盘算。空气中有一种微妙的气氛——似乎所有人都知道些什么，但没有人愿意第一个开口。\n\n角落里，大法师注视着圣坛的方向。主教在神像前祈祷，但他的目光偶尔扫向其他人。老国王没有亲自前来，只是派了骑士来"协助调查"。\n\n一切都不对劲。`,
        suggested_events: [],
        revealed_information: [
          {
            type: "clue",
            title: "异常气氛",
            content: "圣殿中的气氛异常，每个人都显得过于紧张。",
            visible_to: ["all"],
          },
        ],
        suggested_actions: [
          { label: "检查圣坛", action_type: "investigate", target: "temple_altar", method: "examine", intent: "find_clues", risk_level: "low", context: "圣杯原本存放的位置" },
          { label: "与大法师交谈", action_type: "talk", target: "npc_archmage", method: "conversation", intent: "gather_information", risk_level: "low", context: "大法师似乎知道些什么" },
          { label: "观察主教", action_type: "investigate", target: "npc_bishop", method: "observe", intent: "gather_information", risk_level: "medium", context: "主教的行为有些异常" },
        ],
        mood: "tense",
      };
    }

    if (current_turn <= 5) {
      return {
        narration: `调查深入，新的线索浮现。\n\n圣殿地面上发现了古老的符文痕迹，这不是普通的盗窃——这涉及上古的力量。\n\n大法师主动靠近你，低声说："有些力量不应该被唤醒。有些真相不值得去追寻。"他说完便转身离去，留下更多的疑问。\n\n主教则在召集教会的助手，似乎在做某种准备。空气中魔法能量在波动...`,
        suggested_events: [],
        revealed_information: [
          {
            type: "clue",
            title: "上古符文",
            content: "圣殿地面发现了与圣杯有关的古代符文，暗示着古老力量的存在。",
            visible_to: ["all"],
          },
        ],
        suggested_actions: [
          { label: "追踪大法师", action_type: "track", target: "npc_archmage", method: "follow", intent: "track", risk_level: "high", context: "大法师的话意味深长" },
          { label: "进入地下室", action_type: "investigate", target: "cathedral_basement", method: "explore", intent: "investigate", risk_level: "medium", context: "符文指向圣殿地下" },
          { label: "质问主教", action_type: "interrogate", target: "npc_bishop", method: "direct_question", intent: "interrogate", risk_level: "medium", context: "主教隐藏着秘密" },
        ],
        mood: "investigative",
      };
    }

    // Later turns
    return {
      narration: `局势在快速变化。\n\n地下祭坛的秘密已经被发现。大法师的仪式准备工作接近完成。空气中弥漫着远古力量的气息，每个人都能感受到。\n\n王国的命运悬于一线。每个人必须做出最终的选择——是追寻真相，维护秩序，还是实现自己的秘密目标？\n\n时间不多了。`,
      suggested_events: ["archmage_ritual"],
      revealed_information: [],
      suggested_actions: [
        { label: "阻止大法师", action_type: "attack", target: "npc_archmage", method: "intervention", intent: "stop_ritual", risk_level: "high", context: "仪式即将完成" },
        { label: "与角色商议", action_type: "summon_meeting", target: "all_players", method: "discussion", intent: "form_strategy", risk_level: "low", context: "需要共同决策" },
        { label: "揭示发现的真相", action_type: "confess", target: "all", method: "revelation", intent: "share_truth", risk_level: "high", context: "你发现了关键线索" },
      ],
      mood: "climactic",
    };
  },

  async generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null> {
    const { npc_id, npc_goal, local_view } = context;

    // Mock NPC behavior
    if (npc_id === "npc_archmage") {
      return {
        intention: "继续准备仪式，暗中观察局势",
        action_type: "deceive",
        target: "all",
        method: "misdirection",
        reasoning_visible: "大法师似乎在等待某个时机...",
        risk_level: "medium",
      };
    }
    if (npc_id === "npc_old_king") {
      return {
        intention: "派人监视调查进展",
        action_type: "command",
        target: "guards",
        method: "royal_order",
        reasoning_visible: "国王通过密使发布了新的命令。",
        risk_level: "low",
      };
    }
    if (npc_id === "npc_bishop") {
      const target = local_view.known_players[0]?.id || "unknown";
      return {
        intention: "拉拢调查者到教会一方",
        action_type: "persuade",
        target,
        method: "diplomacy",
        reasoning_visible: "主教笑容可掬地向你走来...",
        risk_level: "low",
      };
    }

    return null; // fall through to behavioral rules
  },

  async generateEndingNarrative(context: EndingContext): Promise<string> {
    const { ending_title, key_events } = context;
    return `\n## ${ending_title}\n\n在经历了 ${key_events.length} 个关键事件之后，艾尔德兰的故事迎来了它的结局。\n\n每一个选择都引导着命运走向这一刻。\n\n` + context.world_state_summary.metrics.map((m) => `- ${m.id}: ${m.value}`).join("\n");
  },

  async parseAction(input: string, context: ActionParseContext): Promise<ParsedAction> {
    const lower = input.toLowerCase();

    if (lower.includes("调查") || lower.includes("查看") || lower.includes("检查")) {
      return { action_type: "investigate", target: context.current_location || "unknown", method: "examine", intent: "investigate", risk_level: "low" };
    }
    if (lower.includes("偷听") || lower.includes("窃听")) {
      return { action_type: "eavesdrop", target: context.current_location || "unknown", method: "stealth", intent: "eavesdrop", risk_level: "high" };
    }
    if (lower.includes("刺杀") || lower.includes("暗杀") || lower.includes("杀")) {
      return { action_type: "assassinate", target: "target", method: "attack", intent: "assassinate", risk_level: "high" };
    }
    if (lower.includes("说服") || lower.includes("劝")) {
      return { action_type: "persuade", target: "target", method: "diplomacy", intent: "persuade", risk_level: "medium" };
    }
    if (lower.includes("威胁") || lower.includes("恐吓")) {
      return { action_type: "threaten", target: "target", method: "intimidation", intent: "threaten", risk_level: "medium" };
    }
    if (lower.includes("潜入") || lower.includes("伪装") || lower.includes("假扮")) {
      return { action_type: "investigate", target: context.current_location || "unknown", method: "stealth_disguise", intent: "infiltrate", risk_level: "high" };
    }

    // Default
    return { action_type: "talk", target: "other", method: "conversation", intent: "communicate", risk_level: "low" };
  },
};
