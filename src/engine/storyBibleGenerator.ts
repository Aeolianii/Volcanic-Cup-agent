import type { Ability, Ending, Faction, KnowledgeEntry, NPC, StoryBible, StoryEvent, StorySeed } from "@/types";
import { analyzeStory } from "./storyAnalyzer";
import { adaptStory } from "./storyAdapter";
import { extractFeatures } from "./featureExtractor";
import { selectRulePacks } from "./rulePackSelector";
import { generateMetrics } from "./metricGenerator";
import { generateUIConfig } from "./uiConfigGenerator";

type GenreProfile = "campus" | "romance" | "political" | "sci_fi" | "wuxia" | "generic";

export async function generateStoryBible(seed: StorySeed): Promise<StoryBible> {
  const analysis = analyzeStory(seed);
  const adapted = adaptStory(seed, analysis);
  const characters = parseCharacters(seed.characters);

  const bible: StoryBible = {
    id: `story_${Date.now()}`,
    title: buildTitle(seed),
    version: 1,
    world_setting: {
      era: extractEra(seed),
      location: extractLocation(seed.world_setting || seed.opening || seed.genre),
      atmosphere: seed.world_setting || seed.opening || `${seed.genre || "互动"}故事`,
      magic_system: isSupernatural(seed) ? "依照当前设定运行的特殊力量规则" : undefined,
      technology_level: extractTechnologyLevel(seed),
    },
    roles: characters.map((name, index) => ({
      id: `role_${index + 1}`,
      name,
      type: "player_role" as const,
      public_identity: buildPublicIdentity(name, seed),
      private_background: buildPrivateBackground(name, seed),
      public_goal: buildPublicGoal(name, seed, adapted.additions.role_goals[index]),
      secret_goal: buildSecretGoal(name, seed, adapted.additions.secret_goals[index]),
      starting_location: getStartingLocation(seed, index),
      initial_knowledge: buildInitialKnowledge(name, seed),
      abilities: buildAbilities(name, seed, index),
    })),
    npcs: generateNPCs(seed),
    factions: buildFactions(seed, characters),
    chapters: adapted.additions.chapters.map((chapter, index) => ({
      id: `chapter_${index + 1}`,
      title: chapter.title,
      order: index + 1,
      description: chapter.description,
      entry_conditions: index === 0 ? [] : [`turn >= ${index * 5}`],
      key_events: chapter.key_events,
    })),
    events: generateEvents(seed, adapted.additions.events),
    endings: generateEndings(seed),
    metrics: [],
    rules: [],
    knowledge: generateKnowledge(seed, characters),
    ui_config: { theme: "", layout: "default", widgets: [], display_metrics: [] },
  };

  const features = extractFeatures(bible);
  bible.rules = selectRulePacks(features);
  bible.metrics = generateMetrics(bible);
  bible.ui_config = generateUIConfig(bible);

  return bible;
}

function parseCharacters(input: string): string[] {
  const characters = input
    .split(/[,，、\n\r\t ]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  return characters.length >= 2 ? characters : ["主角", "盟友", "竞争者", "见证者"];
}

function allSeedText(seed: StorySeed): string {
  return [seed.genre, seed.opening, seed.ending, seed.characters, seed.world_setting].join(" ");
}

function getProfile(seed: StorySeed): GenreProfile {
  const text = allSeedText(seed);
  if (/校园|高中|大学|同桌|学生|学生会|社团|班级|毕业|校草|校花|青春|青梅竹马/.test(text)) return "campus";
  if (/言情|恋爱|爱情|暗恋|复合|告白|表白|前任|暧昧/.test(text)) return "romance";
  if (/科幻|星际|空间站|飞船|公司|殖民|AI|机器人|赛博/.test(text)) return "sci_fi";
  if (/武侠|江湖|门派|朝廷|侠客|帮派/.test(text)) return "wuxia";
  if (/王国|王室|贵族|继承|宫廷|帝国|权谋/.test(text)) return "political";
  return "generic";
}

function isSupernatural(seed: StorySeed): boolean {
  return /奇幻|魔法|神器|诅咒|神明|怪谈|灵异|超自然|古神|圣杯/.test(allSeedText(seed));
}

function buildTitle(seed: StorySeed): string {
  const opening = shortText(seed.opening || seed.world_setting || "未命名故事", 18);
  return `${seed.genre || "互动故事"}：${opening}`;
}

function extractEra(seed: StorySeed): string {
  const text = allSeedText(seed);
  if (/现代|校园|高中|大学|都市|职场/.test(text)) return "现代";
  if (/未来|科幻|星际|空间站|赛博/.test(text)) return "近未来";
  if (/武侠|古代|朝廷|江湖/.test(text)) return "古代";
  if (/奇幻|王国|中世纪|宫廷/.test(text)) return "中世纪奇幻";
  return "未指定时代";
}

function extractTechnologyLevel(seed: StorySeed): string {
  const text = allSeedText(seed);
  if (/未来|科幻|星际|空间站|赛博/.test(text)) return "未来科技";
  if (/现代|校园|都市|职场/.test(text)) return "现代";
  if (/武侠|古代|朝廷|江湖/.test(text)) return "古代";
  return "由故事设定决定";
}

function extractLocation(setting: string): string {
  const match = setting.match(/在([^，,\s。]+)/);
  return match ? match[1] : shortText(setting || "故事舞台", 12);
}

function buildPublicIdentity(name: string, seed: StorySeed): string {
  const profile = getProfile(seed);
  if (profile === "campus") {
    if (/转校|新生/.test(name)) return `${name}，刚进入这段校园关系网的新面孔`;
    if (/班长|学生会/.test(name)) return `${name}，负责维持班级或学生会秩序的人`;
    if (/校草|校花|风云/.test(name)) return `${name}，校园舆论中心的人物`;
    if (/闺蜜|好友|朋友/.test(name)) return `${name}，掌握许多私人情绪与关系细节的朋友`;
    return `${name}，卷入校园关系与流言的重要角色`;
  }
  if (profile === "romance") return `${name}，这段关系纠葛中的关键当事人`;
  if (profile === "sci_fi") return `${name}，拥有独立行动权限的任务成员`;
  if (profile === "wuxia") return `${name}，江湖风波中的关键行动者`;
  if (profile === "political") return `${name}，权力局势中的重要人物`;
  return `${name}，卷入核心冲突的重要人物`;
}

function buildPrivateBackground(name: string, seed: StorySeed): string {
  const profile = getProfile(seed);
  const hook = seed.opening || seed.world_setting || "开场事件";
  if (profile === "campus") {
    if (/转校|新生/.test(name)) return `你刚进入这个校园圈层，却已经被“${shortText(hook, 24)}”推到众人视线中。`;
    if (/班长|学生会/.test(name)) return "你习惯把秩序维持好，但这次事件牵扯到你不想公开的一段私事。";
    if (/校草|校花|风云/.test(name)) return "你看似拥有很多关注，其实一直被流言和期待绑住。";
    return "你知道一部分旁人看不到的关系细节，但公开说出它可能会伤害重要的人。";
  }
  if (profile === "romance") return "你对这段关系有真实感情，也有暂时无法公开的顾虑。";
  if (profile === "sci_fi") return "你与任务核心风险存在私人关联，这会影响你对命令的判断。";
  if (profile === "wuxia") return "你身上背着一段旧事，它会影响你在江湖规矩和个人情义之间的选择。";
  if (profile === "political") return "你理解公开身份背后的利益交换，也知道局势中有一部分真相暂时不能说。";
  return `你与“${shortText(hook, 24)}”有私人关联，这段关联暂时不宜公开。`;
}

function buildPublicGoal(name: string, seed: StorySeed, suggested?: string): string {
  if (suggested && !suggested.includes("个人目标")) return suggested;
  const profile = getProfile(seed);
  if (profile === "campus") {
    if (/班长|学生会/.test(name)) return "控制流言扩散，恢复班级和学生会秩序";
    if (/转校|新生/.test(name)) return "洗清误会，在新环境里争取可信任的关系";
    return "弄清误会真相，同时保护自己在校园中的位置";
  }
  if (profile === "romance") return "修复或理清关系，避免误会继续扩大";
  if (profile === "sci_fi") return "完成任务并控制异常风险";
  if (profile === "wuxia") return "查清江湖风波真相，维护自己的名声与立场";
  if (profile === "political") return "争取支持，稳定局势并掌握关键证据";
  return seed.ending ? `推动局势走向：${seed.ending}` : "在混乱中取得主动权";
}

function buildSecretGoal(name: string, seed: StorySeed, suggested?: string): string {
  if (suggested && !suggested.includes("隐藏动机")) return suggested;
  const profile = getProfile(seed);
  if (profile === "campus") {
    if (/转校|新生/.test(name)) return "找到真正散播流言的人，同时保住自己不愿公开的过去。";
    if (/班长|学生会/.test(name)) return "保护一份会影响竞选或关系走向的秘密证据。";
    if (/校草|校花|风云/.test(name)) return "确认自己真正喜欢的人是谁，而不是继续扮演别人期待的样子。";
    return "帮助重要的人脱身，但不能让所有人知道你掌握了关键秘密。";
  }
  if (profile === "romance") return "确认对方真实心意，同时不让自己的脆弱被错误的人利用。";
  if (profile === "sci_fi") return "查清任务背后的隐瞒，即使这会挑战上级命令。";
  if (profile === "wuxia") return "解决一段旧怨，但不能让它吞掉你现在的选择。";
  if (profile === "political") return "暗中证明自己的判断，并找到可以改变权力平衡的关键筹码。";
  return `守住你与“${shortText(seed.opening || "开场事件", 24)}”有关的私人秘密，并把它转化为谈判筹码。`;
}

function buildInitialKnowledge(name: string, seed: StorySeed): string[] {
  const profile = getProfile(seed);
  const facts = ["你知道自己的公开身份、私人背景与秘密目标。"];
  if (seed.opening) facts.push(`你亲历或听闻了开场事件：${seed.opening}`);
  if (profile === "campus") {
    if (/转校|新生/.test(name)) facts.push("你知道自己被卷入流言并非偶然，有人刻意引导了第一波误会。");
    if (/班长|学生会/.test(name)) facts.push("你知道学生会资料或班级记录中有一处时间线对不上。");
    if (/闺蜜|好友|朋友/.test(name)) facts.push("你知道至少有一个当事人没有说出完整心意。");
  } else if (profile === "romance") {
    facts.push("你知道公开争执背后还有未说出口的情绪。");
  } else {
    facts.push(`你知道${seed.world_setting || "当前舞台"}里已经形成了不同立场。`);
  }
  return facts;
}

function buildAbilities(name: string, seed: StorySeed, index: number): Ability[] {
  const profile = getProfile(seed);
  if (profile === "campus" || profile === "romance") {
    return [
      { id: `ability_${index}_1`, name: "观察细节", description: "从表情、聊天记录和现场细节中发现矛盾。", category: "investigation" },
      { id: `ability_${index}_2`, name: /班长|学生会/.test(name) ? "组织协调" : "真诚沟通", description: "通过沟通影响同学、老师或朋友的态度。", category: "social" },
    ];
  }
  return [
    { id: `ability_${index}_1`, name: "洞察", description: "观察和理解他人的能力。", category: "social" },
    { id: `ability_${index}_2`, name: "交涉", description: "通过语言影响他人。", category: "social" },
  ];
}

function buildFactions(seed: StorySeed, characters: string[]): Faction[] {
  const profile = getProfile(seed);
  const roleIdByName = new Map(characters.map((name, index) => [name, `role_${index + 1}`]));
  const opening = seed.opening.trim();

  if (profile === "campus" || profile === "romance") {
    return [
      {
        id: "faction_student_council",
        name: "学生会与班级秩序",
        description: `希望把“${shortText(opening || seed.world_setting || "当前风波", 24)}”控制在校园规则内解决。`,
        goals: ["平息流言", "维持竞选或班级秩序", "保护校方与学生会声誉"],
        members: pickMembers(roleIdByName, ["班长", "学生会"]),
        relationships: { faction_close_friends: 5, faction_rumor_circle: -15 },
      },
      {
        id: "faction_close_friends",
        name: "亲近朋友",
        description: "更关心当事人的真实感受，愿意为了关系修复挑战表面秩序。",
        goals: ["确认真实心意", "保护被误解的人", "找到流言源头"],
        members: pickMembers(roleIdByName, ["闺蜜", "好友", "朋友", "转校"]),
        relationships: { faction_student_council: 5, faction_rumor_circle: -20 },
      },
      {
        id: "faction_rumor_circle",
        name: "流言圈",
        description: "由围观者、竞争者和匿名传播者构成，会根据局势放大误会。",
        goals: ["制造话题", "影响竞选或关系走向", "隐藏真正爆料者"],
        members: pickMembers(roleIdByName, ["校草", "校花", "竞争"]),
        relationships: { faction_student_council: -15, faction_close_friends: -20 },
      },
    ];
  }

  if (profile === "sci_fi") {
    return [
      { id: "faction_command", name: "指挥部", description: "维护任务秩序和资源调度的官方系统。", goals: ["维持任务完整性", "控制信息扩散", "保护核心资产"], members: pickMembers(roleIdByName, ["船长", "指挥官", "军官"]), relationships: { faction_research: 10, faction_frontier: -15 } },
      { id: "faction_research", name: "研究组", description: "追求真相、数据和技术突破的专业群体。", goals: ["获取关键数据", "保全实验成果", "解释异常现象"], members: pickMembers(roleIdByName, ["科学家", "工程师", "医生"]), relationships: { faction_command: 10, faction_frontier: -5 } },
      { id: "faction_frontier", name: "边境同盟", description: "更关心生存、补给和自治权的执行者联盟。", goals: ["争取资源分配", "避免被牺牲", "取得谈判权"], members: [], relationships: { faction_command: -15, faction_research: -5 } },
    ];
  }

  if (profile === "wuxia") {
    return [
      { id: "faction_orthodox", name: "正道盟", description: "以名声、规矩和门派秩序为核心的联盟。", goals: ["维护门派声望", "查清事件真相", "避免江湖失序"], members: pickMembers(roleIdByName, ["侠", "掌门", "弟子"]), relationships: { faction_shadow: -20, faction_court: 5 } },
      { id: "faction_shadow", name: "暗流势力", description: "藏在事件背后的非公开组织。", goals: ["隐藏幕后主使", "夺取关键筹码", "离间各派关系"], members: pickMembers(roleIdByName, ["刺客", "杀手", "魔教"]), relationships: { faction_orthodox: -20, faction_court: -10 } },
      { id: "faction_court", name: "朝廷势力", description: "代表官方秩序和现实权力。", goals: ["平息风波", "掌握证据", "限制江湖失控"], members: pickMembers(roleIdByName, ["捕快", "官员", "将军"]), relationships: { faction_orthodox: 5, faction_shadow: -10 } },
    ];
  }

  const half = Math.ceil(characters.length / 2);
  return [
    { id: "faction_order", name: "秩序维护者", description: "希望维持现状并控制危机扩散的势力。", goals: ["稳定局势", "控制信息", "避免失控"], members: characters.slice(0, half).map((_, index) => `role_${index + 1}`), relationships: { faction_disruptors: -15, faction_neutrals: 5 } },
    { id: "faction_disruptors", name: "破局者", description: "愿意通过揭露、冒险或背叛改变局面的人。", goals: ["打破僵局", "寻找隐藏真相", "夺取主动权"], members: characters.slice(half).map((_, index) => `role_${index + 1 + half}`), relationships: { faction_order: -15, faction_neutrals: -5 } },
    { id: "faction_neutrals", name: "观望者", description: "会根据局势发展选择盟友的中间力量。", goals: ["保护自身利益", "等待局势明朗", "成为谈判方"], members: [], relationships: { faction_order: 5, faction_disruptors: -5 } },
  ];
}

function pickMembers(roleIdByName: Map<string, string>, keywords: string[]): string[] {
  const members: string[] = [];
  for (const [name, roleId] of roleIdByName.entries()) {
    if (keywords.some((keyword) => name.includes(keyword))) members.push(roleId);
  }
  return members;
}

function getStartingLocation(seed: StorySeed, index: number): string {
  const profile = getProfile(seed);
  const locationsByProfile: Record<GenreProfile, string[]> = {
    campus: ["classroom", "student_council_room", "library", "club_room", "sports_field", "cafeteria"],
    romance: ["meeting_place", "quiet_corner", "phone_chat", "shared_memory_place", "public_square"],
    political: ["council_hall", "archive", "garden", "gate", "market"],
    sci_fi: ["command_deck", "research_lab", "hangar", "medbay", "market"],
    wuxia: ["inn", "training_ground", "ancestral_hall", "riverbank", "market"],
    generic: ["central_place", "meeting_place", "archive", "hidden_corner", "public_square"],
  };
  const locations = locationsByProfile[profile];
  return locations[index % locations.length];
}

function generateNPCs(seed: StorySeed): NPC[] {
  const profile = getProfile(seed);
  const templates: Array<Omit<NPC, "id" | "knowledge_scope">> =
    profile === "campus" || profile === "romance"
      ? [
          { name: "班主任", public_identity: "负责班级秩序与学生谈话的老师", personality: "克制、敏锐，重视证据", goal: "尽快平息校园风波", secret_goal: "避免校方处理不当伤害学生", memory: ["近期班级氛围异常", "学生会资料出现过交接混乱"], initial_knowledge: ["老师知道部分时间线记录。"], behavior_style: { aggression: 20, caution: 80, cooperation: 65, deception: 20 } },
          { name: "学生会长", public_identity: "学生会核心负责人，掌握竞选与活动资料", personality: "自信、谨慎，习惯把话说一半", goal: "维护学生会信誉", secret_goal: "隐藏资料外泄前后的真实交接记录", memory: ["竞选前的内部争执", "资料室借阅记录"], initial_knowledge: ["学生会资料不是第一次被人动过。"], behavior_style: { aggression: 35, caution: 70, cooperation: 45, deception: 55 } },
          { name: "社团指导老师", public_identity: "熟悉学生关系和社团活动安排的老师", personality: "温和但不轻易表态", goal: "保护学生关系不被流言撕裂", secret_goal: "找到匿名爆料源头", memory: ["社团排练名单", "毕业晚会准备记录"], initial_knowledge: ["社团活动时间线能证明部分人的去向。"], behavior_style: { aggression: 15, caution: 65, cooperation: 75, deception: 25 } },
        ]
      : profile === "sci_fi"
        ? [
            { name: "任务指挥官", public_identity: "负责整体调度的指挥者", personality: "冷静、重视效率", goal: "控制异常并完成任务", secret_goal: "隐藏上级提前知道风险的事实", memory: ["任务简报", "异常预警记录"], initial_knowledge: ["系统日志曾被修改。"], behavior_style: { aggression: 45, caution: 75, cooperation: 45, deception: 55 } },
            { name: "首席研究员", public_identity: "负责解释异常数据的专家", personality: "好奇、固执", goal: "获得完整数据", secret_goal: "证明自己的理论正确", memory: ["实验记录", "样本波动"], initial_knowledge: ["异常并非自然产生。"], behavior_style: { aggression: 25, caution: 55, cooperation: 55, deception: 35 } },
            { name: "后勤主管", public_identity: "掌握补给、通行和人员排班", personality: "务实、警惕", goal: "保证团队生存", secret_goal: "为底层成员争取撤离优先权", memory: ["补给清单", "通行记录"], initial_knowledge: ["有一段通行记录被删除。"], behavior_style: { aggression: 30, caution: 70, cooperation: 60, deception: 30 } },
          ]
        : [
            { name: "关键见证者", public_identity: "最接近开场事件的人之一", personality: "谨慎、容易紧张", goal: "确保自己不被牵连", secret_goal: "隐瞒自己看到的一部分真相", memory: [seed.opening || "开场事件"], initial_knowledge: ["见证者知道事件发生前后的异常细节。"], behavior_style: { aggression: 10, caution: 80, cooperation: 45, deception: 45 } },
            { name: "秩序代表", public_identity: "负责维持当前规则和公开秩序的人", personality: "强势、讲原则", goal: "控制局势并阻止恐慌", secret_goal: "避免自己的失误被揭露", memory: ["公开调查流程", "内部记录"], initial_knowledge: ["公开报告里有未解释的空白。"], behavior_style: { aggression: 40, caution: 70, cooperation: 45, deception: 40 } },
            { name: "消息中间人", public_identity: "掌握人际消息和非正式渠道的人", personality: "圆滑、善于试探", goal: "用情报换取好处", secret_goal: "在最终站队前保住退路", memory: ["流言来源", "私下交易"], initial_knowledge: ["不同阵营都在打听同一条线索。"], behavior_style: { aggression: 20, caution: 60, cooperation: 55, deception: 70 } },
          ];

  return templates.map((npc, index) => ({
    id: `npc_${index + 1}`,
    ...npc,
    knowledge_scope: "limited" as const,
  }));
}

function generateEvents(seed: StorySeed, adaptedEvents: string[]): StoryEvent[] {
  const core = summarizeOpening(seed);
  const world = seed.world_setting.trim() || "当前舞台";
  const ending = seed.ending.trim();
  const stabilityMetric = stabilityMetricId(seed);
  const pressureMetric = pressureMetricId(seed);
  const generatedEvents = adaptedEvents.filter(Boolean);

  return [
    {
      id: "inciting_incident",
      title: core,
      description: seed.opening || `${world}里的第一场危机已经发生，所有角色都被迫卷入局势。`,
      trigger: { type: "turn_reached", conditions: [{ field: "turn", operator: "gte", value: 1 }] },
      effects: [{ type: "modify_metric", target: "suspicion", value: 10 }],
      visibility: "public",
      triggered: false,
      chapter_id: "chapter_1",
    },
    {
      id: "first_investigation",
      title: "线索调查",
      description: `围绕“${core}”的调查开始推进。角色们需要确认谁获益、谁隐瞒了事实，以及哪些线索被刻意遮掩。`,
      trigger: { type: "action_performed", conditions: [{ field: "event_inciting_incident", operator: "exists", value: true }] },
      effects: [{ type: "modify_metric", target: "truth_progress", value: 15 }],
      visibility: "public",
      triggered: false,
      chapter_id: "chapter_1",
    },
    {
      id: "hidden_truth_discovered",
      title: generatedEvents[0] || "隐藏真相浮现",
      description: `调查揭开了更深层的秘密：${world}。这说明开场危机并非孤立事件。`,
      trigger: { type: "composite", conditions: [{ field: "event_first_investigation", operator: "exists", value: true }, { field: "truth_progress", operator: "gte", value: 30 }], operator: "and" },
      effects: [{ type: "modify_metric", target: pressureMetric, value: 15 }],
      visibility: "conditional",
      triggered: false,
      chapter_id: "chapter_2",
    },
    {
      id: "faction_power_play",
      title: generatedEvents[1] || "阵营公开角力",
      description: `各方势力开始围绕“${core}”重新站队。公开秩序仍在维持，但私下试探、交易和背叛已经发生。`,
      trigger: { type: "composite", conditions: [{ field: "event_hidden_truth_discovered", operator: "exists", value: true }, { field: pressureMetric, operator: "gte", value: 45 }], operator: "and" },
      effects: [{ type: "modify_metric", target: pressureMetric, value: 20 }, { type: "modify_metric", target: stabilityMetric, value: -15 }],
      visibility: "public",
      triggered: false,
      chapter_id: "chapter_3",
    },
    {
      id: "final_crisis",
      title: generatedEvents[2] || "最终危机",
      description: ending ? `局势逼近结局方向：“${ending}”。每个角色此前的选择都会影响最终裁决。` : `局势失控，${world}。所有人必须在真相、关系和代价之间做出选择。`,
      trigger: { type: "composite", conditions: [{ field: "event_faction_power_play", operator: "exists", value: true }, { field: stabilityMetric, operator: "lte", value: 35 }], operator: "and" },
      effects: [{ type: "modify_metric", target: stabilityMetric, value: -20 }, { type: "modify_metric", target: "suspicion", value: 20 }],
      visibility: "public",
      triggered: false,
      chapter_id: "chapter_3",
    },
  ];
}

function generateEndings(seed: StorySeed): Ending[] {
  const profile = getProfile(seed);
  const stabilityMetric = stabilityMetricId(seed);
  const pressureMetric = pressureMetricId(seed);
  if (profile === "campus" || profile === "romance") {
    return [
      { id: "ending_reconciliation", title: "误会解除", description: "关键证据公开，误会被解开，关系得到重新选择。", conditions: [{ type: "metric_threshold", metric_id: "truth_progress", operator: "gte", value: 80 }, { type: "metric_threshold", metric_id: stabilityMetric, operator: "gte", value: 45 }], priority: 1, narrative_prompt: "在证据与真心都被说出口之后，流言终于停下。每个人都必须面对自己真正想守护的关系。" },
      { id: "ending_confession", title: "坦白心意", description: "真相未必完美，但重要的人选择诚实面对彼此。", conditions: [{ type: "metric_threshold", metric_id: "trust", operator: "gte", value: 65 }], priority: 2, narrative_prompt: "最难的不是查清谁对谁错，而是在所有误会之后仍然愿意说真话。" },
      { id: "ending_missed_chance", title: "错过彼此", description: "怀疑和沉默压过真相，关系走向遗憾。", conditions: [{ type: "metric_threshold", metric_id: "suspicion", operator: "gte", value: 75 }], priority: 3, narrative_prompt: "有些话来得太晚，有些误会被放得太久。校园恢复平静，但当事人都知道有些什么已经改变。" },
      { id: "ending_growth", title: "各自成长", description: "没有人完全胜利，但所有人都从风波中学会承担。", conditions: [{ type: "metric_threshold", metric_id: "truth_progress", operator: "gte", value: 50 }], priority: 4, narrative_prompt: "这场风波没有给出完美答案，却让每个人看清了自己的选择。" },
    ];
  }

  return [
    { id: "ending_truth_prevails", title: "真相公开", description: "关键真相被揭示，局势得到修复。", conditions: [{ type: "metric_threshold", metric_id: "truth_progress", operator: "gte", value: 80 }, { type: "metric_threshold", metric_id: stabilityMetric, operator: "gte", value: 45 }], priority: 1, narrative_prompt: "真相终于被摆上台面，所有人的选择共同改变了结局。" },
    { id: "ending_power_shift", title: "格局改写", description: "旧平衡被打破，新势力取得主动权。", conditions: [{ type: "metric_threshold", metric_id: "faction_power", operator: "gte", value: 70 }], priority: 2, narrative_prompt: "权力没有消失，只是换了主人。新的格局从混乱中浮现。" },
    { id: "ending_collapse", title: "秩序崩塌", description: "怀疑和冲突吞没局势，公开秩序彻底失控。", conditions: [{ type: "metric_threshold", metric_id: stabilityMetric, operator: "lte", value: 20 }, { type: "metric_threshold", metric_id: "suspicion", operator: "gte", value: 70 }], priority: 3, narrative_prompt: "当信任瓦解，再清楚的真相也无法立刻修复破碎的秩序。" },
    { id: "ending_hidden_force_wins", title: "隐藏力量得手", description: "幕后目标完成，众人才意识到自己一直被推着走。", conditions: [{ type: "metric_threshold", metric_id: pressureMetric, operator: "gte", value: 80 }], priority: 4, narrative_prompt: "所有人以为自己在寻找答案，直到最后才发现答案早已被别人安排好。" },
  ];
}

function generateKnowledge(seed: StorySeed, characters: string[]): KnowledgeEntry[] {
  const core = summarizeOpening(seed);
  const profile = getProfile(seed);
  const firstRole = characters[0] ? "role_1" : "";
  return [
    { id: "k_public_context", title: "公开背景", content: `${seed.world_setting || seed.genre || "故事舞台"}中，所有人都知道“${core}”已经打破原本平衡。`, category: "public", known_by: [], revealed: true },
    { id: "k_hidden_timeline", title: "时间线疑点", content: "开场事件前后存在一段没有被公开解释的时间线，这可能是破解误会的关键。", category: "clue", known_by: firstRole ? [firstRole] : [], revealed: false },
    { id: "k_secret_motive", title: "隐藏动机", content: "至少有一名关键人物并不是为了公开目标行动，其真实动机会改变局势判断。", category: "secret", known_by: [], revealed: false },
    { id: "k_relationship_pressure", title: profile === "campus" || profile === "romance" ? "未说出口的心意" : "关系压力", content: profile === "campus" || profile === "romance" ? "误会背后有真实情绪和未说出口的心意，强硬逼问可能让关系恶化。" : "人物之间的旧关系会影响他们是否愿意公开真相。", category: "hidden", known_by: [], revealed: false },
  ];
}

function stabilityMetricId(seed: StorySeed): string {
  return /王国|王权|王室|kingdom|宫廷/.test(allSeedText(seed)) ? "political_stability" : "situation_stability";
}

function pressureMetricId(seed: StorySeed): string {
  return isSupernatural(seed) ? "supernatural_pressure" : "faction_power";
}

function summarizeOpening(seed: StorySeed): string {
  return shortText(seed.opening.trim() || seed.world_setting.trim() || "核心事件", 18);
}

function shortText(text: string, max = 22): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}
