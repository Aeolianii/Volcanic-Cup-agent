import type { StoryBible, StoryConsequenceMode } from "@/types";

const NON_LETHAL_SIGNALS = [
  "校园",
  "青春",
  "恋爱",
  "言情",
  "爱情",
  "暗恋",
  "告白",
  "romance",
  "campus",
  "school",
  "slice of life",
];

const LETHAL_SIGNALS = [
  "死亡",
  "谋杀",
  "刺杀",
  "战争",
  "处刑",
  "献祭",
  "恐怖",
  "悬疑命案",
  "末日",
  "战斗",
  "assassination",
  "execution",
  "murder",
  "war",
  "horror",
  "sacrifice",
  "combat",
];

export type DeathConsequenceMode = StoryConsequenceMode;

export function getDeathConsequenceMode(bible: StoryBible): DeathConsequenceMode {
  if (bible.runtime_modules?.consequence_mode) return bible.runtime_modules.consequence_mode;

  const text = [
    bible.title,
    bible.world_setting.era,
    bible.world_setting.location,
    bible.world_setting.atmosphere,
    bible.world_setting.magic_system,
    bible.world_setting.technology_level,
    ...(bible.world_setting.special_rules || []),
    ...bible.rules.map((rule) => `${rule.pack_id} ${rule.pack_type}`),
    ...bible.events.map((event) => `${event.title} ${event.description}`),
  ].join(" ").toLowerCase();

  const hasLethalSignal = LETHAL_SIGNALS.some((signal) => text.includes(signal.toLowerCase()));
  const hasNonLethalSignal = NON_LETHAL_SIGNALS.some((signal) => text.includes(signal.toLowerCase()));

  if (/搞笑|喜剧|欢乐|沙雕|爆笑|整活|乌龙|comedy|funny/i.test(text)) return "comic_setback";
  if (hasNonLethalSignal && !hasLethalSignal) return "romance_failure";
  return "lethal";
}

export function nonLethalFailureLabel(bible: StoryBible): string {
  if (bible.runtime_modules?.consequence_mode === "comic_setback") {
    return bible.runtime_modules.consequence_labels.setback;
  }
  if (bible.runtime_modules?.consequence_labels.non_lethal) {
    return bible.runtime_modules.consequence_labels.non_lethal;
  }

  const text = `${bible.title} ${bible.world_setting.atmosphere}`.toLowerCase();
  if (NON_LETHAL_SIGNALS.some((signal) => text.includes(signal.toLowerCase()))) {
    return "攻略失败";
  }
  return "行动失败并暂时退场";
}
