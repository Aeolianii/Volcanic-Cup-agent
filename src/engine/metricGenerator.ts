import type { Metric, StoryBible } from "@/types";

export function generateMetrics(bible: StoryBible): Metric[] {
  const metrics: Metric[] = [];

  // Story-specific metrics based on content analysis
  const allText = JSON.stringify(bible).toLowerCase();

  if (allText.includes("王国") || allText.includes("kingdom") || allText.includes("王权")) {
    metrics.push({
      id: "kingdom_stability",
      label: "王国稳定度",
      type: "number",
      scope: "global",
      min: 0,
      max: 100,
      initial: 60,
      visibility: "public",
    });
  }

  if (allText.includes("真相") || allText.includes("truth") || allText.includes("秘密") || allText.includes("圣杯")) {
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
  }

  if (allText.includes("圣杯") || allText.includes("神器") || allText.includes("grail") || allText.includes("魔法")) {
    metrics.push({
      id: "holy_grail_influence",
      label: "圣杯影响力",
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

  // Trust & suspicion are universal
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
