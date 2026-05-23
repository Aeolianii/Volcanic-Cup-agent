import type { StoryBible, StorySeed } from "@/types";
import { analyzeStory } from "./storyAnalyzer";
import { adaptStory } from "./storyAdapter";
import { extractFeatures } from "./featureExtractor";
import { selectRulePacks } from "./rulePackSelector";
import { generateMetrics } from "./metricGenerator";
import { generateUIConfig } from "./uiConfigGenerator";

/**
 * Story Bible Generator
 * Generates a full StoryBible from a StorySeed.
 * MVP uses template + procedural generation.
 */
export async function generateStoryBible(seed: StorySeed): Promise<StoryBible> {
  const analysis = analyzeStory(seed);
  const adapted = adaptStory(seed, analysis);

  const characters = seed.characters.split(/[,，、\s]+/).filter(Boolean);

  const bible: StoryBible = {
    id: `story_${Date.now()}`,
    title: `${seed.genre}：${seed.opening.slice(0, 20)}`,
    version: 1,
    world_setting: {
      era: extractEra(seed.world_setting),
      location: extractLocation(seed.world_setting),
      atmosphere: seed.world_setting,
      magic_system: seed.genre.includes("奇幻") ? "中古魔法体系" : undefined,
      technology_level: "中世纪",
    },
    roles: characters.map((name, i) => ({
      id: `role_${i + 1}`,
      name,
      type: "player_role" as const,
      public_identity: `${name} — ${getRandomIdentity(seed.genre)}`,
      private_background: `${name}的过去隐藏着不为人知的秘密...`,
      public_goal: adapted.additions.role_goals[i] || `${name}的目标`,
      secret_goal: adapted.additions.secret_goals[i] || `${name}的秘密`,
      starting_location: getStartingLocation(i),
      initial_knowledge: [`${name}的基本认知`],
      abilities: [
        { id: `ability_${i}_1`, name: "洞察", description: "观察和理解他人的能力", category: "social" },
        { id: `ability_${i}_2`, name: "交涉", description: "通过言语影响他人", category: "social" },
      ],
    })),
    npcs: generateDefaultNPCs(),
    factions: adapted.additions.factions.map((name, i) => ({
      id: `faction_${i + 1}`,
      name,
      description: `${name}是这个世界的重要势力`,
      goals: ["维持影响力", "扩大权力"],
      members: [],
      relationships: {},
    })),
    chapters: adapted.additions.chapters.map((ch, i) => ({
      id: `chapter_${i + 1}`,
      title: ch.title,
      order: i + 1,
      description: ch.description,
      entry_conditions: i === 0 ? [] : [`turn >= ${i * 5}`],
      key_events: ch.key_events,
    })),
    events: generateDefaultEvents(),
    endings: [
      {
        id: "ending_good",
        title: "王国得救",
        description: "真相大白，正义获胜",
        conditions: [
          { type: "metric_threshold", metric_id: "truth_progress", operator: "gte", value: 80 },
          { type: "metric_threshold", metric_id: "kingdom_stability", operator: "gte", value: 50 },
        ],
        priority: 1,
        narrative_prompt: "在所有人的努力下，真相终于大白于天下，王国重归和平...",
      },
      {
        id: "ending_dark",
        title: "古神苏醒",
        description: "隐藏的力量被唤醒，世界陷入黑暗",
        conditions: [
          { type: "metric_threshold", metric_id: "holy_grail_influence", operator: "gte", value: 80 },
          { type: "flag_set", flag: "ancient_ritual_complete", operator: "eq", value: true },
        ],
        priority: 2,
        narrative_prompt: "古神苏醒了，黑暗笼罩大地，一切希望似乎都已破灭...",
      },
      {
        id: "ending_collapse",
        title: "王权崩塌",
        description: "旧秩序崩溃，权力真空",
        conditions: [
          { type: "metric_threshold", metric_id: "kingdom_stability", operator: "lte", value: 20 },
          { type: "metric_threshold", metric_id: "suspicion", operator: "gte", value: 70 },
        ],
        priority: 3,
        narrative_prompt: "王国在猜忌和混乱中分崩离析，旧王权就此终结...",
      },
      {
        id: "ending_revolution",
        title: "刺客革命成功",
        description: "暗处的力量推翻了旧秩序",
        conditions: [
          { type: "flag_set", flag: "assassination_successful", operator: "eq", value: true },
          { type: "flag_set", flag: "revolution_ready", operator: "eq", value: true },
        ],
        priority: 4,
        narrative_prompt: "刺客们的利刃斩断了旧时代的锁链，新时代在血与火中诞生...",
      },
    ],
    metrics: [],
    rules: [],
    knowledge: [
      {
        id: "k1",
        title: "圣杯的传说",
        content: "传说圣杯拥有不可思议的力量，但真相早已被时间掩埋...",
        category: "public",
        known_by: [],
        revealed: true,
      },
      {
        id: "k2",
        title: "王室的秘密",
        content: "王室血脉中隐藏着古老的诅咒...",
        category: "hidden",
        known_by: [],
        revealed: false,
      },
      {
        id: "k3",
        title: "教会的真实目的",
        content: "教会寻找圣杯并非为了信仰...",
        category: "secret",
        known_by: [],
        revealed: false,
      },
    ],
    ui_config: { theme: "", layout: "default", widgets: [], display_metrics: [] },
  };

  // Post-processing
  const features = extractFeatures(bible);
  bible.rules = selectRulePacks(features);
  bible.metrics = generateMetrics(bible);
  bible.ui_config = generateUIConfig(bible);

  return bible;
}

function extractEra(setting: string): string {
  if (setting.includes("现代")) return "现代";
  if (setting.includes("未来")) return "未来";
  if (setting.includes("科幻")) return "近未来";
  return "中世纪幻想";
}

function extractLocation(setting: string): string {
  const match = setting.match(/在([^，,\s]+)/);
  return match ? match[1] : "幻想大陆";
}

function getRandomIdentity(genre: string): string {
  const identities: Record<string, string[]> = {
    "西幻": ["流浪骑士", "贵族后裔", "神秘术士", "王国继承人", "教会使者"],
    "科幻": ["太空船长", "机械工程师", "基因改造者", "殖民地领袖"],
    "武侠": ["江湖侠客", "名门弟子", "隐居高手", "门派掌门"],
  };

  const pool = identities[genre] || ["冒险者", "探索者", "守护者", "追寻者"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getStartingLocation(index: number): string {
  const locations = ["throne_room", "temple", "city_streets", "tavern", "royal_library"];
  return locations[index % locations.length];
}

function generateDefaultNPCs() {
  return [
    {
      id: "npc_archmage",
      name: "大法师",
      public_identity: "王国首席法师，智慧与神秘并存",
      personality: "深沉睿智，话语中总藏着第二层含义",
      goal: "研究圣杯的秘密",
      secret_goal: "利用圣杯力量召唤古神",
      memory: ["圣杯的历史", "古神的传说", "王室的秘密"],
      initial_knowledge: ["圣杯的力量", "古代仪式的知识"],
      knowledge_scope: "limited" as const,
      behavior_style: { aggression: 30, caution: 80, cooperation: 40, deception: 70 },
    },
    {
      id: "npc_old_king",
      name: "老国王",
      public_identity: "年迈的王国统治者，表面上威严仁慈",
      personality: "表面仁慈，内心多疑",
      goal: "维护王权稳定",
      secret_goal: "找到圣杯获得永生",
      memory: ["王国历史", "王室血脉的秘密"],
      initial_knowledge: ["圣杯失踪的线索", "教会异动"],
      knowledge_scope: "limited" as const,
      behavior_style: { aggression: 40, caution: 70, cooperation: 50, deception: 60 },
    },
    {
      id: "npc_bishop",
      name: "主教",
      public_identity: "教会最高领袖，信仰的守护者",
      personality: "虔诚表面下是政治野心",
      goal: "扩大教会影响力",
      secret_goal: "单独控制圣杯",
      memory: ["教会的密令", "圣殿的秘道"],
      initial_knowledge: ["圣杯的宗教意义", "圣殿的秘密"],
      knowledge_scope: "limited" as const,
      behavior_style: { aggression: 50, caution: 60, cooperation: 30, deception: 80 },
    },
  ];
}

function generateDefaultEvents() {
  return [
    {
      id: "holy_grail_stolen",
      title: "圣杯失窃",
      description: "圣殿中的圣杯一夜之间消失无踪，守卫没有发现任何入侵痕迹。",
      trigger: {
        type: "turn_reached",
        conditions: [{ field: "turn", operator: "gte", value: 1 }],
      },
      effects: [
        { type: "set_flag", target: "", value: true },
        { type: "modify_metric", target: "suspicion", value: 10 },
      ],
      visibility: "public" as const,
      triggered: false,
      chapter_id: "chapter_1",
    },
    {
      id: "temple_investigation",
      title: "圣殿调查",
      description: "圣殿内发现了奇怪的符文，似乎与某种古老仪式有关。",
      trigger: {
        type: "action_performed",
        conditions: [
          { field: "event_holy_grail_stolen", operator: "exists", value: true },
        ],
      },
      effects: [
        { type: "add_knowledge", target: "", value: "ancient_runes" },
        { type: "modify_metric", target: "truth_progress", value: 15 },
      ],
      visibility: "public" as const,
      triggered: false,
      chapter_id: "chapter_1",
    },
    {
      id: "underground_altar_discovered",
      title: "地下祭坛发现",
      description: "在圣殿下方发现了一个古老的地下祭坛，上面刻满了诡异符文。",
      trigger: {
        type: "composite",
        conditions: [
          { field: "event_temple_investigation", operator: "exists", value: true },
          { field: "truth_progress", operator: "gte", value: 30 },
        ],
        operator: "and",
      },
      effects: [
        { type: "reveal_event", target: "", value: "ancient_ritual_site" },
        { type: "modify_metric", target: "holy_grail_influence", value: 20 },
      ],
      visibility: "conditional" as const,
      triggered: false,
      chapter_id: "chapter_2",
    },
    {
      id: "archmage_ritual",
      title: "大法师仪式",
      description: "大法师在祭坛进行了一场神秘仪式，圣杯的力量开始苏醒...",
      trigger: {
        type: "composite",
        conditions: [
          { field: "event_underground_altar_discovered", operator: "exists", value: true },
          { field: "holy_grail_influence", operator: "gte", value: 50 },
        ],
        operator: "and",
      },
      effects: [
        { type: "set_flag", target: "", value: true },
        { type: "modify_metric", target: "holy_grail_influence", value: 30 },
        { type: "modify_metric", target: "kingdom_stability", value: -20 },
      ],
      visibility: "public" as const,
      triggered: false,
      chapter_id: "chapter_3",
    },
    {
      id: "kingdom_unrest",
      title: "王国动乱",
      description: "圣杯力量的影响波及全国，王国各地出现混乱。",
      trigger: {
        type: "composite",
        conditions: [
          { field: "event_archmage_ritual", operator: "exists", value: true },
          { field: "kingdom_stability", operator: "lte", value: 30 },
        ],
        operator: "and",
      },
      effects: [
        { type: "modify_metric", target: "kingdom_stability", value: -30 },
        { type: "modify_metric", target: "suspicion", value: 20 },
      ],
      visibility: "public" as const,
      triggered: false,
      chapter_id: "chapter_3",
    },
  ];
}
