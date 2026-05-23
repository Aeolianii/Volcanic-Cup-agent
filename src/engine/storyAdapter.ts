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

type AdapterProfile = "campus" | "romance" | "transmigration" | "comedy" | "workplace" | "mystery" | "horror" | "generic";

export function adaptStory(seed: StorySeed, analysis: StoryAnalysis): AdaptedStory {
  const profile = getProfile(seed);
  const isRelationshipStory = profile === "campus" || profile === "romance";
  const track = getProfileTrack(profile);
  const additions: StoryAdditions = {
    role_goals: [],
    secret_goals: [],
    factions: [],
    conflicts: [],
    events: [],
    chapters: [],
    ending_conditions: [],
  };

  if (!analysis.features.has_factions) {
    if (track.lightweightStances) {
      additions.factions.push(...track.stances);
      additions.conflicts.push(track.conflict);
    } else if (isRelationshipStory) {
      additions.factions.push("班级秩序维护者", "亲近朋友", "流言传播者");
      additions.conflicts.push("公开形象、真实心意与流言压力之间的冲突");
    } else {
      additions.factions.push("秩序维护者", "破局者", "观望者");
      additions.conflicts.push("现有秩序与改变局势的冲突");
    }
  }

  if (!analysis.features.has_mystery) {
    if (track.events.length > 0) {
      additions.events.push(...track.events);
    } else if (isRelationshipStory) {
      additions.events.push("匿名帖子继续发酵", "聊天记录出现矛盾", "当事人被迫公开回应");
    } else {
      additions.events.push("异常事件发生", "关键证据失踪", "重要证人失联");
    }
  }

  if (!analysis.features.has_conflict) {
    if (track.conflict) {
      additions.conflicts.push(track.conflict);
    } else if (isRelationshipStory) {
      additions.conflicts.push("误会扩散", "关系信任被动摇");
    } else {
      additions.conflicts.push("权利争夺", "资源分配不均");
    }
  }

  if (!analysis.features.has_relationships) {
    additions.role_goals.push("寻找盟友", "获取信任", "重建关系");
  }

  additions.chapters = track.chapters.length > 0
    ? track.chapters
    : isRelationshipStory
    ? [
        {
          title: "开端：流言发酵",
          description: "误会从公开场合扩散，角色之间的关系开始紧张。",
          key_events: ["rumor_spreads", "character_introductions"],
        },
        {
          title: "发展：证据与心意",
          description: "聊天记录、时间线和未说出口的心意逐渐浮现。",
          key_events: ["message_clue", "relationship_pressure"],
        },
        {
          title: "高潮：公开回应",
          description: "当事人必须选择澄清、沉默、坦白或保护某个人。",
          key_events: ["public_response", "truth_revealed"],
        },
      ]
    : [
        {
          title: "序幕：疑云密布",
          description: "关键人物聚集，事件开始发酵。",
          key_events: ["initial_event", "character_introductions"],
        },
        {
          title: "发展：暗流涌动",
          description: "调查深入，秘密逐渐浮出水面。",
          key_events: ["key_discovery", "faction_conflict"],
        },
        {
          title: "高潮：真相大白",
          description: "最终真相揭示，各方摊牌。",
          key_events: ["final_confrontation", "truth_revealed"],
        },
      ];

  additions.ending_conditions = track.endings.length > 0
    ? track.endings
    : isRelationshipStory
    ? [
        "误会被澄清，关系得到重新选择",
        "真心未能说出口，关系留下遗憾",
        "每个人都从流言中学会承担后果",
      ]
    : [
        "真相被揭示，秩序得到修复",
        "隐藏力量获胜，局势陷入混乱",
        "各方达成平衡，维持现状",
      ];

  const characters = seed.characters.split(/[,，、\s]+/).filter(Boolean);
  for (const character of characters) {
    additions.role_goals.push(`${character}的个人目标`);
    additions.secret_goals.push(`${character}的隐藏动机`);
  }

  return {
    original: seed,
    additions,
    enhanced_seed: {
      ...seed,
      characters: seed.characters,
      opening: `${seed.opening}\n\n角色目标：${additions.role_goals.join("；")}`,
      ending: `${seed.ending}\n\n可能的结局：${additions.ending_conditions.join("；")}`,
    },
  };
}

function getProfile(seed: StorySeed): AdapterProfile {
  const text = [seed.genre, seed.opening, seed.ending, seed.characters, seed.world_setting].join(" ");
  if (/穿越|重生|异世界|回到|魂穿|时空|古穿今|今穿古/.test(text)) return "transmigration";
  if (/欢乐|喜剧|轻喜剧|搞笑|沙雕|爆笑|整活|乌龙/.test(text)) return "comedy";
  if (/职场|公司|项目|同事|老板|客户|汇报|创业|办公室/.test(text)) return "workplace";
  if (/推理|侦探|案件|凶案|线索|嫌疑|证词|密室|破案/.test(text)) return "mystery";
  if (/恐怖|怪谈|灵异|惊悚|诡异|逃生|规则怪谈/.test(text)) return "horror";
  if (/校园|高中|大学|同桌|学生|学生会|社团|班级|毕业|校草|校花|青春|青梅竹马/.test(text)) return "campus";
  if (/言情|恋爱|爱情|暗恋|复合|告白|表白|前任|暧昧/.test(text)) return "romance";
  return "generic";
}

function getProfileTrack(profile: AdapterProfile): {
  lightweightStances: boolean;
  stances: string[];
  conflict: string;
  events: string[];
  chapters: ChapterSuggestion[];
  endings: string[];
} {
  switch (profile) {
    case "transmigration":
      return {
        lightweightStances: true,
        stances: ["原世界牵挂", "新身份关系", "规则守护者"],
        conflict: "角色必须在适应新规则、保住身份和改变原剧情之间做选择",
        events: ["初到异世", "身份误认", "规则适应"],
        chapters: [
          { title: "开端：初到异世", description: "角色进入陌生时空，身份和规则都需要重新确认。", key_events: ["arrival", "identity_mistake"] },
          { title: "发展：规则适应", description: "角色理解新世界规则，同时发现自己可能改写原本走向。", key_events: ["rule_learning", "plot_deviation"] },
          { title: "高潮：去留抉择", description: "角色必须决定回归、留下，或承担改变剧情的代价。", key_events: ["choice_point", "timeline_result"] },
        ],
        endings: ["回到原点但带着改变", "留在新世界承担新身份", "改写关键事件付出代价"],
      };
    case "comedy":
      return {
        lightweightStances: true,
        stances: ["认真派", "整活派", "收拾残局的人"],
        conflict: "乌龙不断升级，角色必须在面子、真相和收场之间互相补台",
        events: ["乌龙开场", "误会升级", "集体整活"],
        chapters: [
          { title: "开端：乌龙开场", description: "一个小误会被所有人用错误方式理解。", key_events: ["comic_mistake", "bad_explanation"] },
          { title: "发展：越描越黑", description: "角色越想补救，局面越离谱。", key_events: ["escalation", "group_scheme"] },
          { title: "高潮：爆笑收束", description: "所有误会在公开场合撞到一起，必须现场圆回来。", key_events: ["public_crash", "comic_resolution"] },
        ],
        endings: ["误会解除全员社死", "乌龙变成意外成功", "有人背锅但关系更近"],
      };
    case "workplace":
      return {
        lightweightStances: true,
        stances: ["项目推进方", "风险控制方", "资源协调方"],
        conflict: "任务压力、信息不对称和资源分配让团队目标互相牵制",
        events: ["任务压力出现", "信息不对称", "资源协调"],
        chapters: [
          { title: "开端：任务压下来", description: "项目目标明确，但资源、时间或信息明显不足。", key_events: ["briefing", "resource_gap"] },
          { title: "发展：协作摩擦", description: "团队成员开始暴露不同优先级和隐藏顾虑。", key_events: ["coordination_issue", "private_agenda"] },
          { title: "高潮：公开汇报", description: "成果、责任和真实问题必须被摆上台面。", key_events: ["presentation", "decision"] },
        ],
        endings: ["项目成功但关系改变", "问题公开后重新分工", "短期失败换来长期信任"],
      };
    case "mystery":
      return {
        lightweightStances: false,
        stances: [],
        conflict: "证词、动机和证据之间互相矛盾",
        events: ["案发现场确认", "线索收集", "证词矛盾"],
        chapters: [
          { title: "开端：异常发生", description: "核心事件发生，所有线索暂时互相矛盾。", key_events: ["case_open", "first_clue"] },
          { title: "发展：证词冲突", description: "调查推进，证词和证据逐渐暴露矛盾。", key_events: ["testimony_conflict", "hidden_evidence"] },
          { title: "高潮：真相还原", description: "关键证据连接起来，角色必须还原事件。", key_events: ["key_evidence", "deduction"] },
        ],
        endings: ["真相被完整还原", "真凶脱身但动机曝光", "错误推理造成代价"],
      };
    case "horror":
      return {
        lightweightStances: true,
        stances: ["逃离者", "规则破解者", "被影响者"],
        conflict: "角色必须在恐惧、规则和生存代价之间做选择",
        events: ["异常征兆", "规则发现", "代价出现"],
        chapters: [
          { title: "开端：异常征兆", description: "环境出现不合理变化，但规则尚未被理解。", key_events: ["omen", "first_rule"] },
          { title: "发展：规则代价", description: "角色发现行动会触发代价，彼此信任开始动摇。", key_events: ["rule_cost", "survival_choice"] },
          { title: "高潮：逃离或沉沦", description: "最后的规则被揭开，角色必须决定谁承担代价。", key_events: ["final_rule", "escape_or_fall"] },
        ],
        endings: ["成功逃离但留下阴影", "有人牺牲换来出口", "规则吞没所有人"],
      };
    default:
      return { lightweightStances: false, stances: [], conflict: "", events: [], chapters: [], endings: [] };
  }
}
