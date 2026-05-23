import type { StorySeed } from "@/types";
import type { StoryAnalysis } from "./storyAnalyzer";

export interface AdaptedStory {
  original: StorySeed;
  additions: StoryAdditions;
  enhanced_seed: StorySeed;
}

export interface StoryAdditions {
  role_goals: string[];
  secret_goals: string[];
  factions: string[];
  conflicts: string[];
  events: string[];
  chapters: ChapterSuggestion[];
  ending_conditions: string[];
}

export interface ChapterSuggestion {
  title: string;
  description: string;
  key_events: string[];
}

export function adaptStory(seed: StorySeed, analysis: StoryAnalysis): AdaptedStory {
  const additions: StoryAdditions = {
    role_goals: [],
    secret_goals: [],
    factions: [],
    conflicts: [],
    events: [],
    chapters: [],
    ending_conditions: [],
  };

  // Add missing elements based on analysis
  if (!analysis.features.has_factions) {
    additions.factions.push("王室派", "教会派", "民间势力");
    additions.conflicts.push("王权与教权的争斗");
  }

  if (!analysis.features.has_mystery) {
    additions.events.push("神秘事件发生", "关键物品失踪", "目击者离奇死亡");
  }

  if (!analysis.features.has_conflict) {
    additions.conflicts.push("继承权之争", "资源分配不均");
  }

  if (!analysis.features.has_relationships) {
    additions.role_goals.push("寻找盟友", "获取信任", "重建关系");
  }

  // Generate chapter structure
  additions.chapters = [
    {
      title: "序幕：疑云密布",
      description: "各方势力聚集，事件开始发酵",
      key_events: ["initial_event", "character_introductions"],
    },
    {
      title: "发展：暗流涌动",
      description: "调查深入，秘密逐渐浮出水面",
      key_events: ["key_discovery", "faction_conflict"],
    },
    {
      title: "高潮：真相大白",
      description: "最终真相揭示，各方摊牌",
      key_events: ["final_confrontation", "truth_revealed"],
    },
  ];

  // Generate ending conditions
  additions.ending_conditions = [
    "真相被揭示，正义得到伸张",
    "黑暗势力获胜，世界陷入混乱",
    "各方达成平衡，维持现状",
  ];

  // Generate character goals
  const characters = seed.characters.split(/[,，、\s]+/).filter(Boolean);
  for (const char of characters) {
    additions.role_goals.push(`${char}的个人目标`);
    additions.secret_goals.push(`${char}的隐藏动机`);
  }

  return {
    original: seed,
    additions,
    enhanced_seed: {
      ...seed,
      characters: seed.characters,
      opening: `${seed.opening}\n\n各方势力的目标：${additions.role_goals.join("；")}`,
      ending: `${seed.ending}\n\n可能的结局：${additions.ending_conditions.join("；")}`,
    },
  };
}
