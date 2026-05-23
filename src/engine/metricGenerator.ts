import type { Metric, StoryBible } from "@/types";

export function generateMetrics(bible: StoryBible): Metric[] {
  const metrics: Metric[] = [];
  const allText = JSON.stringify(bible).toLowerCase();

  if (/王国|王权|王室|kingdom|宫廷/.test(allText)) {
    metrics.push({
      id: "political_stability",
      label: "政治稳定度",
      type: "number",
      scope: "global",
      min: 0,
      max: 100,
      initial: 60,
      visibility: "public",
    });
  } else {
    metrics.push({
      id: "situation_stability",
      label: "局势稳定度",
      type: "number",
      scope: "global",
      min: 0,
      max: 100,
      initial: 60,
      visibility: "public",
    });
  }

  metrics.push({
    id: "truth_progress",
    label: "真相进度",
    type: "number",
    scope: "global",
    min: 0,
    max: 100,
    initial: 0,
    visibility: "public",
  });

  if (/魔法|神器|圣杯|超自然|仪式|古神|grail|artifact/.test(allText)) {
    metrics.push({
      id: "supernatural_pressure",
      label: "超自然压力",
      type: "number",
      scope: "global",
      min: 0,
      max: 100,
      initial: 30,
      visibility: "conditional",
    });
  }

  if (bible.factions.length > 0) {
    metrics.push({
      id: "faction_power",
      label: "阵营影响力",
      type: "number",
      scope: "faction",
      min: 0,
      max: 100,
      initial: 50,
      visibility: "public",
    });
  }

  metrics.push({
    id: "trust",
    label: "信任度",
    type: "number",
    scope: "relationship",
    min: 0,
    max: 100,
    initial: 40,
    visibility: "conditional",
  });

  metrics.push({
    id: "suspicion",
    label: "怀疑值",
    type: "number",
    scope: "global",
    min: 0,
    max: 100,
    initial: 20,
    visibility: "hidden",
  });

  return metrics;
}
