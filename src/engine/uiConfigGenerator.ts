import type { UIConfig, WidgetConfig, StoryBible } from "@/types";

export function generateUIConfig(bible: StoryBible): UIConfig {
  const widgets: WidgetConfig[] = [
    { key: "NarrativePanel", position: "center", order: 1, visible: true },
    { key: "ChatPanel", position: "bottom", order: 2, visible: true },
    { key: "SuggestedActionsPanel", position: "right", order: 3, visible: true },
    { key: "FreeActionInput", position: "bottom", order: 4, visible: true },
    { key: "RolePanel", position: "left", order: 5, visible: true },
    { key: "MetricPanel", position: "left", order: 6, visible: true },
    { key: "EventPanel", position: "right", order: 7, visible: true },
    { key: "EvidencePanel", position: "right", order: 8, visible: true },
    { key: "PlayerInfoPanel", position: "left", order: 9, visible: true },
  ];

  if (bible.factions.length > 0) {
    widgets.push({ key: "FactionPanel", position: "right", order: 10, visible: true });
  }

  const displayMetrics = bible.metrics
    .filter((m) => m.visibility === "public")
    .map((m) => m.id);

  return {
    theme: "dark_fantasy",
    layout: "default",
    widgets,
    display_metrics: displayMetrics,
  };
}
