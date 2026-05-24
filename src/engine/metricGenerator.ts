import type { Metric, StoryBible } from "@/types";

export type ScriptProfile =
  | "romance"
  | "relationship"
  | "sci_fi"
  | "war"
  | "fantasy"
  | "political"
  | "mystery"
  | "generic";

export function generateMetrics(bible: StoryBible): Metric[] {
  const profile = inferScriptProfile(bible);
  const byRole = roleMetrics(bible, profile);
  const metricsByProfile: Record<ScriptProfile, Metric[]> = {
    romance: [
      metric("memory_alignment", "记忆归位度", 0, "public"),
      metric("emotional_clarity", "真心确认度", 20, "public"),
      metric("illusion_attachment", "虚妄依恋度", 45, "conditional"),
      metric("regret_pressure", "遗憾压力", 25, "hidden"),
      ...byRole,
    ],
    relationship: [
      metric("relationship_truth", "关系真相度", 10, "public"),
      metric("group_consensus", "群像共识", 20, "public"),
      metric("conflict_heat", "关系张力", 25, "public"),
      metric("secret_exposure", "秘密暴露度", 0, "conditional"),
      ...byRole,
    ],
    sci_fi: [
      metric("system_integrity", "系统完整度", 60, "public"),
      metric("data_truth", "数据真相度", 0, "public"),
      metric("anomaly_pressure", "异常压力", 30, "conditional"),
      metric("humanity_anchor", "人性锚定", 45, "public"),
      metric("control_risk", "失控风险", 20, "hidden"),
      ...byRole.slice(0, 6),
    ],
    war: [
      metric("frontline_pressure", "战线压力", 45, "public"),
      metric("supply_level", "补给水平", 50, "public"),
      metric("morale", "士气", 55, "public"),
      metric("intelligence_grasp", "情报掌握", 0, "conditional"),
      metric("casualty_risk", "伤亡风险", 25, "hidden"),
      metric("faction_power", "势力影响", 50, "public", "faction"),
    ],
    fantasy: [
      metric("realm_stability", "王国稳定度", 60, "public"),
      metric("arcane_pressure", "魔法压力", 30, "conditional"),
      metric("truth_progress", "真相进度", 0, "public"),
      metric("faction_power", "阵营影响", 50, "public", "faction"),
      metric("trust", "信任度", 40, "conditional", "relationship"),
    ],
    political: [
      metric("political_stability", "政局稳定度", 55, "public"),
      metric("public_support", "民意支持", 45, "public", "faction"),
      metric("strategy_progress", "筹码掌握", 20, "conditional"),
      metric("faction_power", "派系权势", 50, "public", "faction"),
      metric("scandal_risk", "丑闻风险", 20, "hidden"),
    ],
    mystery: [
      metric("truth_progress", "真相破解度", 0, "public"),
      metric("evidence_integrity", "证据完整度", 20, "public"),
      metric("core_scene_exploration", `${firstLocationName(bible)}探索度`, 0, "public"),
      metric("danger_pressure", "危机压力", 30, "conditional"),
      ...suspectMetrics(bible),
    ],
    generic: [
      metric("situation_stability", "局势稳定度", 60, "public"),
      metric("truth_progress", "真相进度", 0, "public"),
      metric("group_momentum", "群像推进度", 30, "public"),
      ...byRole.slice(0, 6),
    ],
  };

  return dedupeMetrics([...metricsByProfile[profile], ...compatibilityMetrics(profile)]);
}

export function inferScriptProfile(bible: StoryBible): ScriptProfile {
  const text = JSON.stringify({
    title: bible.title,
    world: bible.world_setting,
    roles: bible.roles.map((role) => `${role.name} ${role.public_identity} ${role.public_goal} ${role.secret_goal}`),
    factions: bible.factions.map((faction) => `${faction.name} ${faction.description} ${faction.goals.join(" ")}`),
    endings: bible.endings.map((ending) => `${ending.title} ${ending.description}`),
    modules: bible.runtime_modules,
  });

  if (/战争|军团|战线|补给|战役|指挥|士气|伤亡|前线/.test(text)) return "war";
  if (/权谋|宫廷|王室|议会|继承|政变|贵族|派系|权势|朝堂/.test(text)) return "political";
  if (/西幻|奇幻|魔法|王国|圣杯|神器|骑士|法师|古神|龙|神殿/.test(text)) return "fantasy";
  if (/悬疑|推理|凶案|线索|证据|嫌疑|密室|侦探|真凶|解密|探险/.test(text) && !/无凶案|无案件|无推理/.test(text)) return "mystery";
  if (/言情|心动|爱意|恋人|暗恋|奔赴真心|虚妄|情感抉择|群像言情/.test(text)) return "romance";
  if (/关系|羁绊|误会|和解|友情|亲情|同伴|群像/.test(text)) return "relationship";
  if (/赛博|科幻|AI|人工智能|全息|系统|数据|记忆|未来都市|2047/.test(text)) return "sci_fi";
  return "generic";
}

function roleMetrics(bible: StoryBible, profile: ScriptProfile): Metric[] {
  if (!["romance", "relationship", "sci_fi", "generic"].includes(profile)) return [];
  return bible.roles.flatMap((role, index) => {
    const suffix = safeId(role.id || role.name || `role_${index + 1}`);
    const labelName = role.name || `角色${index + 1}`;
    return [
      metric(`affection_${suffix}`, `${labelName}好感度`, 35, "conditional", "relationship"),
      metric(`trust_${suffix}`, `${labelName}信任度`, 40, "conditional", "relationship"),
    ];
  });
}

function suspectMetrics(bible: StoryBible): Metric[] {
  return bible.roles.map((role, index) =>
    metric(`suspicion_${safeId(role.id || role.name || `role_${index + 1}`)}`, `${role.name || `角色${index + 1}`}嫌疑值`, 20, "conditional", "relationship")
  );
}

function compatibilityMetrics(profile: ScriptProfile): Metric[] {
  if (profile === "romance" || profile === "relationship" || profile === "sci_fi") {
    return [
      metric("truth_progress", profile === "sci_fi" ? "数据真相度" : "记忆真相度", 0, "public"),
      metric("situation_stability", profile === "sci_fi" ? "系统稳定度" : "情感稳定度", 60, "public"),
      metric("suspicion", profile === "sci_fi" ? "异常疑点" : "误会压力", 20, "conditional", "relationship"),
      metric("faction_power", profile === "sci_fi" ? "系统主动权" : "关系主动权", 45, "conditional", "relationship"),
    ];
  }
  if (profile === "mystery") {
    return [
      metric("situation_stability", "局面稳定度", 55, "public"),
      metric("suspicion", "总体嫌疑压力", 20, "conditional"),
      metric("faction_power", "关键人物主动权", 45, "conditional", "relationship"),
    ];
  }
  return [
    metric("truth_progress", "真相进度", 0, "public"),
    metric("situation_stability", "局势稳定度", 60, "public"),
    metric("suspicion", "疑虑压力", 20, "conditional"),
    metric("faction_power", "势力主动权", 45, "public", "faction"),
  ];
}

function firstLocationName(bible: StoryBible): string {
  const location = bible.world_setting.location || "核心场景";
  return location.length > 10 ? "核心场景" : location;
}

function metric(
  id: string,
  label: string,
  initial: number,
  visibility: Metric["visibility"],
  scope: Metric["scope"] = "global"
): Metric {
  return {
    id,
    label,
    type: "number",
    scope,
    min: 0,
    max: 100,
    initial,
    visibility,
  };
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fa5]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "role";
}

function dedupeMetrics(metrics: Metric[]): Metric[] {
  const seen = new Set<string>();
  return metrics.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
