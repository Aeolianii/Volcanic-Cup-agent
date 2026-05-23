import type { StorySeed } from "@/types";

export interface StoryAnalysis {
  playable: boolean;
  playable_score: number;
  features: StoryFeaturesAnalysis;
  missing_elements: string[];
  suggested_fixes: string[];
}

export interface StoryFeaturesAnalysis {
  has_conflict: boolean;
  has_mystery: boolean;
  has_factions: boolean;
  has_relationships: boolean;
  has_survival_pressure: boolean;
  has_resource_competition: boolean;
}

export function analyzeStory(seed: StorySeed): StoryAnalysis {
  const features = extractSeedFeatures(seed);
  const missing: string[] = [];
  const fixes: string[] = [];

  let score = 50;

  if (!features.has_conflict) {
    missing.push("核心冲突");
    fixes.push("建议补充一个会迫使角色做选择的主要矛盾。");
    score -= 15;
  } else {
    score += 10;
  }

  if (!features.has_mystery) {
    missing.push("可探索信息");
    fixes.push("建议补充误会、线索、秘密、规则或未知目标，让玩家有调查空间。");
    score -= 5;
  } else {
    score += 10;
  }

  if (!features.has_factions) {
    missing.push("立场差异");
    fixes.push("建议补充至少两种利益或态度不同的立场，不一定是正式阵营。");
    score -= 5;
  } else {
    score += 10;
  }

  if (!features.has_relationships) {
    missing.push("角色关系网");
    fixes.push("建议补充角色之间的信任、误会、竞争、亲密或旧怨。");
    score -= 5;
  } else {
    score += 5;
  }

  const characterCount = seed.characters.split(/[,，、\s]+/).filter(Boolean).length;
  if (characterCount < 3) {
    missing.push("角色数量不足，至少建议 3 个角色");
    fixes.push("建议增加更多玩家角色以支持多人互动。");
    score -= 10;
  } else {
    score += 5;
  }

  if (!seed.world_setting || seed.world_setting.length < 10) {
    missing.push("世界观设定不够详细");
    fixes.push("建议说明故事发生地点、规则、氛围和当前压力。");
    score -= 5;
  }

  return {
    playable: score >= 40,
    playable_score: Math.max(0, Math.min(100, score)),
    features,
    missing_elements: missing,
    suggested_fixes: fixes,
  };
}

function extractSeedFeatures(seed: StorySeed): StoryFeaturesAnalysis {
  const text = `${seed.genre} ${seed.opening} ${seed.ending} ${seed.characters} ${seed.world_setting}`.toLowerCase();

  return {
    has_conflict: /冲突|战争|对抗|敌对|争夺|权谋|阴谋|背叛|误会|竞争|危机|任务|目标|选择|矛盾|压力/.test(text),
    has_mystery: /谜|秘密|真相|悬疑|调查|推理|失踪|失窃|线索|异常|误会|聊天记录|规则|未知|隐藏/.test(text),
    has_factions: /阵营|势力|国家|家族|组织|教派|王国|帝国|学生会|社团|公司|部门|团队|班级|圈子|立场/.test(text),
    has_relationships: /关系|爱情|友情|亲情|婚姻|联盟|师徒|同学|同事|朋友|暗恋|告白|信任|背叛|旧怨/.test(text),
    has_survival_pressure: /生存|末日|饥荒|瘟疫|灾难|危险|死亡|逃生|恐怖|怪谈|追杀/.test(text),
    has_resource_competition: /资源|财富|宝藏|圣杯|神器|魔法|领地|预算|名额|资格|情报|票数|道具/.test(text),
  };
}
