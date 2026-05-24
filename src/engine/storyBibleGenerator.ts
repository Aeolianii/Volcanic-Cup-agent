import type { Ability, Ending, Faction, KnowledgeEntry, NPC, StoryBible, StoryEvent, StorySeed } from "@/types";
import { analyzeStory } from "./storyAnalyzer";
import { adaptStory } from "./storyAdapter";
import { extractFeatures } from "./featureExtractor";
import { selectRulePacks } from "./rulePackSelector";
import { generateMetrics } from "./metricGenerator";
import { generateUIConfig } from "./uiConfigGenerator";
import { enrichStoryBibleForSimulation } from "./storyAdaptationLayer";

type GenreProfile =
  | "campus"
  | "romance"
  | "transmigration"
  | "comedy"
  | "workplace"
  | "mystery"
  | "horror"
  | "political"
  | "sci_fi"
  | "wuxia"
  | "generic";

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
    roles: characters.map((name, index) => {
      const detail = extractCharacterDetail(name, seed.character_details || "");
      return {
        id: `role_${index + 1}`,
        name,
        type: "player_role" as const,
        public_identity: buildPublicIdentity(name, seed, detail),
        private_background: buildPrivateBackground(name, seed, detail),
        public_goal: buildPublicGoal(name, seed, adapted.additions.role_goals[index], detail),
        secret_goal: buildSecretGoal(name, seed, adapted.additions.secret_goals[index], detail),
        starting_location: getStartingLocation(seed, index),
        initial_knowledge: buildInitialKnowledge(name, seed),
        abilities: buildAbilities(name, seed, index),
      };
    }),
    npcs: generateNPCs(seed),
    factions: buildFactions(seed, characters),
    character_models: [],
    faction_models: [],
    relationship_graph: { edges: [] },
    knowledge_graph: { facts: [] },
    victory_conditions: [],
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

  return enrichStoryBibleForSimulation(bible, seed);
}

function extractCharacterDetail(name: string, details: string): string {
  if (!details.trim()) return "";
  const lines = details
    .split(/[\n；;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const direct = lines.find((line) => line.startsWith(`${name}：`) || line.startsWith(`${name}:`));
  if (direct) return direct.replace(new RegExp(`^${escapeRegExp(name)}[：:]\\s*`), "").trim();

  const mention = lines.find((line) => line.includes(name));
  return mention || "";
}

function extractFieldFromDetail(detail: string, labels: string[]): string {
  if (!detail) return "";
  for (const label of labels) {
    const pattern = new RegExp(`${label}[：:是为]?\\s*([^。；;\\n]+)`);
    const match = detail.match(pattern);
    if (match?.[1]) {
      return cleanGoalText(match[1], label).trim();
    }
  }
  return "";
}

function cleanGoalText(value: string, currentLabel = ""): string {
  let output = value.trim();
  const boundaryLabels = ["公开目标", "公开目的", "表面目标", "秘密目标", "秘密目的", "隐藏动机", "真实目标", "人物关系", "关系", "冲突", "性格", "公开身份", "身份", "职业"]
    .filter((label) => label !== currentLabel);

  for (const label of boundaryLabels) {
    const index = output.search(new RegExp(`[，,、\\s]*${label}[：:是为]?`));
    if (index > 0) output = output.slice(0, index).trim();
  }

  return output.replace(/^[：:，,、\s]+/, "").replace(/[，,、\s]+$/, "");
}

function sanitizePublicGoal(goal: string): string {
  return cleanGoalText(goal)
    .replace(/秘密目标[：:是为]?.*$/, "")
    .replace(/秘密目的[：:是为]?.*$/, "")
    .replace(/隐藏动机[：:是为]?.*$/, "")
    .trim();
}

function sanitizeSecretGoal(goal: string): string {
  return cleanGoalText(goal)
    .replace(/公开目标[：:是为]?.*$/, "")
    .replace(/公开目的[：:是为]?.*$/, "")
    .trim();
}

function inferIdentityFromName(name: string, seed: StorySeed, detail = ""): string {
  const text = `${name} ${detail}`;
  const directIdentity = extractFieldFromDetail(detail, ["公开身份", "身份", "职业", "表面身份"]);
  if (directIdentity) return `${name}，${shortText(directIdentity, 28)}`;

  const patterns: Array<[RegExp, string]> = [
    [/失踪者妹妹|妹妹/, "执意追查失踪真相的亲属"],
    [/继承人/, "背负家族资产与旧债的继承人"],
    [/退休刑警|刑警|侦探|调查员|记者/, "擅长追查线索的调查者"],
    [/摄影师|画家|作家|插画师/, "用创作记录异常细节的观察者"],
    [/老板|店主|馆主|经理/, "掌握场所秘密与经营压力的负责人"],
    [/常客|住客|客人|旅客/, "熟悉现场却隐瞒来意的滞留者"],
    [/医生|护士|法医/, "能判断伤情与时间线的专业人士"],
    [/律师|顾问|地产|商人/, "擅长谈判并牵涉利益交换的人"],
    [/学生|班长|社长/, "处在校园关系网中心的学生"],
  ];
  for (const [pattern, identity] of patterns) {
    if (pattern.test(text)) return `${name}，${identity}`;
  }

  const profile = getProfile(seed);
  if (profile === "mystery") return `${name}，掌握部分线索且有私人隐瞒的嫌疑人之一`;
  if (profile === "horror") return `${name}，在危险环境中寻找生路的幸存者`;
  if (profile === "political") return `${name}，牵涉权力交换与秘密承诺的行动者`;
  return `${name}，与开场事件存在明确私人关联的行动者`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCharacters(input: string): string[] {
  const characters = input
    .split(/[,，、\n\r\t ]+/)
    .map((name) => name.trim().replace(/^(人物|角色)\s*[：:]/, ""))
    .filter((name) => name && name.length <= 12)
    .filter((name) => !/(公开目标|秘密目标|公开目的|秘密目的|人物性格|性格|关系|冲突|目标|秘密|背景)/.test(name));
  return characters.length >= 2 ? characters.slice(0, 8) : ["主角", "盟友", "竞争者", "见证者"];
}

function allSeedText(seed: StorySeed): string {
  return [seed.genre, seed.opening, seed.ending, seed.characters, seed.character_details, seed.world_setting].join(" ");
}

function getProfile(seed: StorySeed): GenreProfile {
  const text = allSeedText(seed);
  if (/穿越|重生|异世界|回到|魂穿|时空|古穿今|今穿古/.test(text)) return "transmigration";
  if (/欢乐|喜剧|轻喜剧|搞笑|沙雕|爆笑|整活|乌龙/.test(text)) return "comedy";
  if (/职场|公司|项目|同事|老板|客户|汇报|创业|办公室/.test(text)) return "workplace";
  if (/推理|侦探|案件|凶案|线索|嫌疑|证词|密室|破案/.test(text)) return "mystery";
  if (/恐怖|怪谈|灵异|惊悚|诡异|逃生|规则怪谈/.test(text)) return "horror";
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

function buildPublicIdentity(name: string, seed: StorySeed, detail = ""): string {
  if (detail) return inferIdentityFromName(name, seed, detail);
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

function buildPrivateBackground(name: string, seed: StorySeed, detail = ""): string {
  if (detail) {
    const secret = extractFieldFromDetail(detail, ["秘密目标", "秘密目的", "隐藏动机", "秘密"]);
    const personality = extractFieldFromDetail(detail, ["性格", "人物性格"]);
    const relation = extractFieldFromDetail(detail, ["关系", "人物关系", "冲突"]);
    const pieces = [
      personality ? `你${personality}` : "",
      relation ? `你与其他人存在这层关系：${relation}` : "",
      secret ? `你暂时不想公开的是：${secret}` : "",
    ].filter(Boolean);
    if (pieces.length > 0) return pieces.join("；") + "。";
    return shortText(detail, 90);
  }
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

function containsSecretMarker(text: string): boolean {
  return /(秘密目标|秘密目的|隐藏动机|真实目标|不能公开|暗中|隐瞒)/.test(text);
}

function isStrongSecretGoal(goal: string): boolean {
  if (!isValidGoal(goal)) return false;
  if (goal.length < 8) return false;
  if (/^(保护自己|查清真相|隐藏秘密|完成个人目标|寻找真相)$/.test(goal.trim())) return false;
  return true;
}

function buildIdentityBasedSecretGoal(name: string, seed: StorySeed, detail = ""): string {
  const text = `${name} ${detail}`;
  if (/失踪者妹妹|妹妹|亲属/.test(text)) return "确认亲人失踪背后的真正责任人，同时隐瞒自己私下调查得到的关键证据";
  if (/继承人/.test(text)) return "隐藏家族旧债或遗嘱矛盾，确保自己不会失去继承资格";
  if (/退休刑警|刑警|侦探|调查员|记者/.test(text)) return "弥补过去调查中的失误，同时避免自己当年的判断被公开质疑";
  if (/摄影师|画家|作家|插画师/.test(text)) return "保住自己拍到或记录下的关键材料，并用它换取主动权";
  if (/老板|店主|馆主|经理/.test(text)) return "掩盖场所经营记录中的异常，避免旧事件牵连到自己";
  if (/常客|住客|客人|旅客/.test(text)) return "隐藏自己来到现场的真实原因，并找回只属于自己的那份证据";
  if (/医生|护士|法医/.test(text)) return "隐瞒自己对伤情或死亡时间的特殊判断，等待更安全的公开时机";
  if (/律师|顾问|地产|商人/.test(text)) return "取得能影响交易或责任归属的把柄，同时避免利益关系曝光";
  const hook = shortText(seed.opening || seed.world_setting || "核心事件", 18);
  return `查清自己与“${hook}”的私人关联是否会曝光，并提前控制对自己不利的证据`;
}

function buildPublicGoal(name: string, seed: StorySeed, suggested?: string, detail = ""): string {
  const detailGoal = sanitizePublicGoal(extractFieldFromDetail(detail, ["公开目标", "公开目的", "表面目标"]));
  if (isValidGoal(detailGoal) && !containsSecretMarker(detailGoal)) return detailGoal;
  const suggestedGoal = sanitizePublicGoal(suggested || "");
  if (suggestedGoal && isValidGoal(suggestedGoal) && !containsSecretMarker(suggestedGoal)) return suggestedGoal;
  const profile = getProfile(seed);
  
  // Mystery/Investigation genre (民宿、推理、悬疑)
  if (profile === "mystery" || /民宿|客栈|旅馆|酒店|推理|悬疑|侦探|真相/.test(seed.genre || "")) {
    if (/老板|店主|经理/.test(name)) return "维护场所声誉，配合调查尽快平息事件";
    if (/客人|住客|旅客/.test(name)) return "洗清嫌疑，安全离开当前环境";
    if (/知情|目击者/.test(name)) return "在保护自身安全的前提下提供线索";
    return "查清事件真相，证明自己的清白";
  }
  
  if (profile === "campus") {
    if (/班长|学生会/.test(name)) return "控制流言扩散，恢复班级和学生会秩序";
    if (/转校|新生/.test(name)) return "洗清误会，在新环境里争取可信任的关系";
    return "弄清误会真相，同时保护自己在校园中的位置";
  }
  if (profile === "romance") return "修复或理清关系，避免误会继续扩大";
  if (profile === "sci_fi") return "完成任务并控制异常风险";
  if (profile === "wuxia") return "查清江湖风波真相，维护自己的名声与立场";
  if (profile === "political") return "争取支持，稳定局势并掌握关键证据";
  if (profile === "horror") return "生存下来并逃离危险环境";
  if (profile === "comedy") return "化解尴尬局面，让事情朝有趣的方向发展";
  if (profile === "workplace") return "完成项目目标，同时维护职场关系";
  
  // Generic but specific goals - never use full ending description
  const genericGoals = [
    "在混乱中保护自身安全并找到可信的盟友",
    "查清事件真相，避免成为替罪羊",
    "争取关键人物的信任，获得行动空间",
    "找到可以改变局势的关键证据或信息",
    "在各方势力中保持平衡，等待最佳时机",
  ];
  return genericGoals[Math.floor(Math.random() * genericGoals.length)];
}

function buildSecretGoal(name: string, seed: StorySeed, suggested?: string, detail = ""): string {
  const detailGoal = sanitizeSecretGoal(extractFieldFromDetail(detail, ["秘密目标", "秘密目的", "隐藏动机", "真实目标"]));
  if (isStrongSecretGoal(detailGoal)) return detailGoal;
  const suggestedGoal = sanitizeSecretGoal(suggested || "");
  if (isStrongSecretGoal(suggestedGoal)) return suggestedGoal;
  const identityBased = buildIdentityBasedSecretGoal(name, seed, detail);
  if (identityBased) return identityBased;
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
  if (profile === "horror") return "隐藏自己已经被影响或感染的事实，寻找自救方法。";
  if (profile === "comedy") return "在不破坏关系的前提下，让对手出丑或承认错误。";
  if (profile === "workplace") return "获取可以保护自己或威胁对手的关键把柄。";
  
  // Generic but specific secret goals - never use full opening description
  const genericSecretGoals = [
    "隐藏自己与核心事件的关联，同时收集对他人的把柄",
    "找到可以证明自己清白或嫁祸他人的关键证据",
    "在不暴露身份的情况下，影响事件走向对自己有利",
    "利用信息差获取谈判筹码，确保最终全身而退",
    "完成私人复仇或补偿，同时维持表面的无辜形象",
  ];
  return genericSecretGoals[Math.floor(Math.random() * genericSecretGoals.length)];
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
        members: pickMembers(roleIdByName, ["班长", "学生会", "会长"]),
        relationships: { faction_close_friends: 5, faction_rumor_circle: -15 },
      },
      {
        id: "faction_close_friends",
        name: "亲近朋友",
        description: "更关心当事人的真实感受，愿意为了关系修复挑战表面秩序。",
        goals: ["确认真实心意", "保护被误解的人", "找到流言源头"],
        members: pickMembers(roleIdByName, ["闺蜜", "好友", "朋友", "转校", "转学", "青梅", "竹马", "学姐", "学长"]),
        relationships: { faction_student_council: 5, faction_rumor_circle: -20 },
      },
      {
        id: "faction_rumor_circle",
        name: "流言圈",
        description: "由围观者、竞争者和匿名传播者构成，会根据局势放大误会。",
        goals: ["制造话题", "影响竞选或关系走向", "隐藏真正爆料者"],
        members: pickMembers(roleIdByName, ["校草", "校花", "竞争", "匿名", "爆料", "流言"]),
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
    transmigration: ["arrival_place", "identity_scene", "rule_archive", "market", "choice_crossroads"],
    comedy: ["mistake_scene", "public_stage", "backstage", "cleanup_corner", "group_chat"],
    workplace: ["meeting_room", "workstation", "archive", "client_site", "presentation_room"],
    mystery: ["case_scene", "archive", "interview_room", "hidden_corner", "evidence_board"],
    horror: ["entrance", "safe_room", "rule_board", "forbidden_area", "exit_path"],
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
  const profile = getProfile(seed);
  const generatedEvents = sanitizeEventSuggestions(adaptedEvents, profile);
  const eventTrack = getEventTrack(profile);

  if (eventTrack) {
    return eventTrack.map((node, index) => ({
      id: node.id,
      title: generatedEvents[index - 1] || (index === 0 ? core : node.title),
      description:
        index === 0
          ? seed.opening || node.description(world, core, ending)
          : node.description(world, core, ending),
      trigger:
        index === 0
          ? { type: "turn_reached", conditions: [{ field: "turn", operator: "gte", value: 1 }] }
          : node.trigger,
      effects: node.effects(stabilityMetric),
      visibility: node.visibility,
      triggered: false,
      chapter_id: `chapter_${Math.min(3, Math.floor(index / 2) + 1)}`,
    }));
  }

  if (profile === "campus" || profile === "romance") {
    return [
      {
        id: "inciting_incident",
        title: core,
        description: seed.opening || `${world}里出现了一场关系风波，误会开始在公开场合扩散。`,
        trigger: { type: "turn_reached", conditions: [{ field: "turn", operator: "gte", value: 1 }] },
        effects: [{ type: "modify_metric", target: "suspicion", value: 10 }],
        visibility: "public",
        triggered: false,
        chapter_id: "chapter_1",
      },
      {
        id: "message_clue",
        title: generatedEvents[0] || "聊天记录疑点",
        description: `围绕“${core}”的细节开始被重新核对。聊天记录、时间线和在场人的说法之间出现了不一致。`,
        trigger: { type: "action_performed", conditions: [{ field: "event_inciting_incident", operator: "exists", value: true }] },
        effects: [{ type: "modify_metric", target: "truth_progress", value: 15 }],
        visibility: "public",
        triggered: false,
        chapter_id: "chapter_1",
      },
      {
        id: "relationship_pressure",
        title: generatedEvents[1] || "关系压力升高",
        description: "当事人开始在澄清、沉默和保护彼此之间摇摆。越多人围观，真实心意越难直接说出口。",
        trigger: { type: "composite", conditions: [{ field: "event_message_clue", operator: "exists", value: true }, { field: "truth_progress", operator: "gte", value: 30 }], operator: "and" },
        effects: [{ type: "modify_metric", target: "trust", value: -5 }, { type: "modify_metric", target: "suspicion", value: 10 }],
        visibility: "public",
        triggered: false,
        chapter_id: "chapter_2",
      },
      {
        id: "private_confession_window",
        title: generatedEvents[2] || "私下坦白机会",
        description: "关键人物有机会避开围观，把误会背后的真实原因和未说出口的心意讲清楚。",
        trigger: { type: "composite", conditions: [{ field: "event_relationship_pressure", operator: "exists", value: true }, { field: "truth_progress", operator: "gte", value: 45 }], operator: "and" },
        effects: [{ type: "modify_metric", target: "trust", value: 15 }],
        visibility: "conditional",
        triggered: false,
        chapter_id: "chapter_2",
      },
      {
        id: "public_response",
        title: "公开回应",
        description: ending ? `局势逼近结局方向：“${ending}”。角色们必须决定是公开澄清、私下和解，还是继续保护某个秘密。` : "流言已经发酵到必须回应的程度。每个人此前的选择都会影响关系能否被修复。",
        trigger: { type: "composite", conditions: [{ field: "event_private_confession_window", operator: "exists", value: true }, { field: stabilityMetric, operator: "lte", value: 45 }], operator: "and" },
        effects: [{ type: "modify_metric", target: stabilityMetric, value: -10 }, { type: "modify_metric", target: "suspicion", value: 10 }],
        visibility: "public",
        triggered: false,
        chapter_id: "chapter_3",
      },
    ];
  }

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

function sanitizeEventSuggestions(events: string[], profile: GenreProfile): string[] {
  const forbidden =
    profile === "campus" || profile === "romance"
      ? /死亡|死|尸|谋杀|刺杀|暗杀|血|神秘事件|离奇|势力|站队|战队|权力|王国|宫廷/
      : /$^/;

  return events
    .map((event) => event.trim())
    .filter((event) => event && !forbidden.test(event));
}

type EventTrackNode = {
  id: string;
  title: string;
  description: (world: string, core: string, ending: string) => string;
  trigger: StoryEvent["trigger"];
  effects: (stabilityMetric: string) => StoryEvent["effects"];
  visibility: StoryEvent["visibility"];
};

function getEventTrack(profile: GenreProfile): EventTrackNode[] | null {
  const after = (eventId: string): StoryEvent["trigger"] => ({
    type: "composite",
    conditions: [{ field: `event_${eventId}`, operator: "exists", value: true }],
    operator: "and",
  });
  const progressAfter = (eventId: string, progress: number): StoryEvent["trigger"] => ({
    type: "composite",
    conditions: [
      { field: `event_${eventId}`, operator: "exists", value: true },
      { field: "truth_progress", operator: "gte", value: progress },
    ],
    operator: "and",
  });

  const tracks: Partial<Record<GenreProfile, EventTrackNode[]>> = {
    campus: relationshipTrack(),
    romance: relationshipTrack(),
    transmigration: [
      node("arrival", "初到异世", (world) => `${world}的规则突然压到角色身上，原本的身份和常识都不再可靠。`, after("arrival"), [["suspicion", 10]], "public"),
      node("identity_mistake", "身份误认", (_world, core) => `围绕“${core}”，角色被迫扮演或澄清一个并不完全属于自己的身份。`, after("arrival"), [["truth_progress", 10]], "public"),
      node("rule_learning", "规则适应", () => "角色逐渐理解新世界的规则，也发现某些选择会改变原本剧情。", progressAfter("identity_mistake", 20), [["truth_progress", 15]], "public"),
      node("plot_deviation", "剧情偏移", () => "一个原本应该发生的节点被改变，新的后果开始追上所有人。", progressAfter("rule_learning", 35), [["faction_power", 10]], "conditional"),
      node("choice_point", "去留抉择", (_world, _core, ending) => ending ? `结局方向逼近：“${ending}”。角色必须选择回归、留下或承担改写剧情的代价。` : "角色必须选择回归、留下或承担改写剧情的代价。", progressAfter("plot_deviation", 50), [["situation_stability", -10]], "public"),
    ],
    comedy: [
      node("comic_mistake", "乌龙开场", (_world, core) => `“${core}”被所有人用错误方式理解，局面开始失控。`, after("comic_mistake"), [["suspicion", 5]], "public"),
      node("bad_explanation", "越解释越黑", () => "角色试图补救，但每一次解释都制造了新的误会。", after("comic_mistake"), [["truth_progress", 10]], "public"),
      node("group_scheme", "集体整活", () => "众人决定用一个看似聪明的办法收场，风险也随之变大。", progressAfter("bad_explanation", 20), [["faction_power", 10]], "public"),
      node("public_crash", "公开翻车", () => "所有补救方案在公开场合撞到一起，必须现场圆回来。", progressAfter("group_scheme", 35), [["suspicion", 15]], "public"),
      node("comic_resolution", "爆笑收束", (_world, _core, ending) => ending ? `局面朝“${ending}”收束，但每个人都留下了足够难忘的黑历史。` : "误会被拆开，关系反而因为这场闹剧更近了一步。", progressAfter("public_crash", 45), [["situation_stability", 10]], "public"),
    ],
    workplace: [
      node("briefing", "任务压力出现", (_world, core) => `围绕“${core}”，项目目标明确，但资源、时间或信息明显不足。`, after("briefing"), [["suspicion", 5]], "public"),
      node("resource_gap", "资源缺口", () => "团队发现关键资源并不够用，必须重新协调优先级。", after("briefing"), [["faction_power", 10]], "public"),
      node("coordination_issue", "协作摩擦", () => "不同角色的目标和顾虑开始暴露，协作成本上升。", progressAfter("resource_gap", 20), [["trust", -5]], "public"),
      node("private_agenda", "隐藏顾虑浮现", () => "有人没有说出的真实压力成为项目推进的关键变量。", progressAfter("coordination_issue", 35), [["truth_progress", 15]], "conditional"),
      node("presentation", "公开汇报", (_world, _core, ending) => ending ? `汇报节点逼近：“${ending}”。成果、责任和真实问题必须被摆上台面。` : "成果、责任和真实问题必须被摆上台面。", progressAfter("private_agenda", 50), [["situation_stability", -10]], "public"),
    ],
    mystery: [
      node("case_open", "异常发生", (_world, core) => `“${core}”成为所有调查的起点，现场留下的第一批信息互相矛盾。`, after("case_open"), [["suspicion", 10]], "public"),
      node("first_clue", "线索收集", () => "玩家开始整理现场、证词和时间线，真相进度被推进。", after("case_open"), [["truth_progress", 15]], "public"),
      node("testimony_conflict", "证词矛盾", () => "不同角色的说法无法同时成立，隐藏动机开始浮现。", progressAfter("first_clue", 25), [["suspicion", 10]], "public"),
      node("key_evidence", "关键证据", () => "一项证据把分散的线索连接起来，但公开它会改变所有人的处境。", progressAfter("testimony_conflict", 45), [["truth_progress", 20]], "conditional"),
      node("deduction", "真相还原", (_world, _core, ending) => ending ? `结局方向逼近：“${ending}”。角色必须决定如何公开推理结果。` : "角色必须决定如何公开推理结果，以及谁来承担真相的代价。", progressAfter("key_evidence", 65), [["situation_stability", -10]], "public"),
    ],
    horror: [
      node("omen", "异常征兆", (world) => `${world}出现了第一处无法解释的异常，安全感开始崩塌。`, after("omen"), [["suspicion", 10]], "public"),
      node("first_rule", "规则发现", () => "角色发现异常并非随机发生，某些行为会触发明确代价。", after("omen"), [["truth_progress", 10]], "public"),
      node("rule_cost", "代价出现", () => "规则的代价第一次真正落到角色身上，信任开始动摇。", progressAfter("first_rule", 25), [["trust", -10]], "public"),
      node("survival_choice", "生存选择", () => "继续探索、互相保护或牺牲某些利益，变成无法回避的问题。", progressAfter("rule_cost", 40), [["situation_stability", -15]], "conditional"),
      node("escape_or_fall", "逃离或沉沦", (_world, _core, ending) => ending ? `结局方向逼近：“${ending}”。最后的规则要求角色支付代价。` : "最后的规则被揭开，角色必须决定谁承担代价。", progressAfter("survival_choice", 55), [["suspicion", 15]], "public"),
    ],
  };

  return tracks[profile] || null;
}

function relationshipTrack(): EventTrackNode[] {
  return [
    node("inciting_incident", "流言发酵", (_world, core) => `“${core}”开始扩散，角色之间的关系被迫暴露在公开目光下。`, afterTurnOne(), [["suspicion", 10]], "public"),
    node("message_clue", "聊天记录疑点", (_world, core) => `围绕“${core}”的细节开始被重新核对。聊天记录、时间线和在场人的说法之间出现了不一致。`, afterEvent("inciting_incident"), [["truth_progress", 15]], "public"),
    node("relationship_pressure", "关系压力升高", () => "当事人开始在澄清、沉默和保护彼此之间摇摆。越多人围观，真实心意越难直接说出口。", afterProgress("message_clue", 30), [["trust", -5], ["suspicion", 10]], "public"),
    node("private_confession_window", "私下坦白机会", () => "关键人物有机会避开围观，把误会背后的真实原因和未说出口的心意讲清楚。", afterProgress("relationship_pressure", 45), [["trust", 15]], "conditional"),
    node("public_response", "公开回应", (_world, _core, ending) => ending ? `局势逼近结局方向：“${ending}”。角色们必须决定是公开澄清、私下和解，还是继续保护某个秘密。` : "流言已经发酵到必须回应的程度。每个人此前的选择都会影响关系能否被修复。", afterProgress("private_confession_window", 55), [["situation_stability", -10], ["suspicion", 10]], "public"),
  ];
}

function node(
  id: string,
  title: string,
  description: EventTrackNode["description"],
  trigger: StoryEvent["trigger"],
  metricDeltas: Array<[string, number]>,
  visibility: StoryEvent["visibility"]
): EventTrackNode {
  return {
    id,
    title,
    description,
    trigger,
    effects: (stabilityMetric) =>
      metricDeltas.map(([target, value]) => ({
        type: "modify_metric",
        target: target === "situation_stability" ? stabilityMetric : target,
        value,
      })),
    visibility,
  };
}

function afterTurnOne(): StoryEvent["trigger"] {
  return { type: "turn_reached", conditions: [{ field: "turn", operator: "gte", value: 1 }] };
}

function afterEvent(eventId: string): StoryEvent["trigger"] {
  return { type: "action_performed", conditions: [{ field: `event_${eventId}`, operator: "exists", value: true }] };
}

function afterProgress(eventId: string, progress: number): StoryEvent["trigger"] {
  return {
    type: "composite",
    conditions: [
      { field: `event_${eventId}`, operator: "exists", value: true },
      { field: "truth_progress", operator: "gte", value: progress },
    ],
    operator: "and",
  };
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

/**
 * Check if a suggested goal is valid (not too vague or too long)
 * Rejects goals that look like story summaries or contain generic placeholders
 */
function isValidGoal(goal: string): boolean {
  if (!goal || goal.trim().length === 0) return false;
  
  // Reject if too long (likely a story summary)
  if (goal.length > 60) return false;
  
  // Reject if contains story-summary indicators
  const vagueIndicators = [
    "推动局势走向",
    "真凶浮出水面",
    "执念幻影",
    "众人坦诚",
    "归于平静",
    "当年间接害死",
    "秘密曝光",
    "天光破晓",
    "众人离开",
    "过往遗憾",
    "同时找到能够",
    "改变局势的筹码",
  ];
  if (vagueIndicators.some((indicator) => goal.includes(indicator))) {
    return false;
  }
  
  // Reject generic placeholders
  const genericPlaceholders = ["个人目标", "隐藏动机", "关键秘密", "改变局势"];
  if (genericPlaceholders.includes(goal.trim())) return false;
  
  return true;
}
