import type { UIConfig, WidgetConfig, StoryBible } from "@/types";
import { inferScriptProfile, type ScriptProfile } from "./metricGenerator";

export function generateUIConfig(bible: StoryBible): UIConfig {
  const profile = inferScriptProfile(bible);
  const widgets: WidgetConfig[] = [
    widget("NarrativePanel", "center", 1, { mode: profile }),
    widget("ChatPanel", "bottom", 2, { channel_mode: chatMode(profile) }),
    widget("SuggestedActionsPanel", "right", 3, { strategy: actionStrategy(profile) }),
    widget("FreeActionInput", "bottom", 4),
    widget("RolePanel", "left", 5, { sheet_mode: roleSheetMode(profile) }),
    widget("MetricPanel", "left", 6, { profile, metric_style: metricStyle(profile) }),
    widget("EventPanel", "right", 7, { timeline: timelineMode(profile) }),
    widget("EvidencePanel", "right", 8, { label: evidenceLabel(profile) }),
    widget("PlayerInfoPanel", "left", 9),
  ];

  if (usesFactionPanel(profile) && bible.factions.length > 0) {
    widgets.push(widget("FactionPanel", "right", 10, { label: "阵营" }));
  }

  return {
    theme: themeForProfile(profile),
    layout: profile === "war" || profile === "political" ? "split" : "default",
    widgets,
    display_metrics: bible.metrics
      .filter((metric) => metric.visibility === "public")
      .map((metric) => metric.id),
  };
}

export function usesFactionPanel(profile: ScriptProfile): boolean {
  return profile === "war" || profile === "fantasy" || profile === "political" || profile === "sci_fi";
}

function widget(
  key: string,
  position: WidgetConfig["position"],
  order: number,
  props?: Record<string, unknown>
): WidgetConfig {
  return { key, position, order, visible: true, props };
}

function chatMode(profile: ScriptProfile): string {
  if (profile === "romance" || profile === "relationship") return "relationship_private";
  if (profile === "mystery") return "public_private_investigation";
  return "faction_private";
}

function roleSheetMode(profile: ScriptProfile): string {
  if (profile === "romance") return "relationship_memory";
  if (profile === "relationship") return "ensemble_bonds";
  if (profile === "war") return "operation_role";
  if (profile === "political") return "influence_role";
  return profile;
}

function themeForProfile(profile: ScriptProfile): string {
  const themes: Record<ScriptProfile, string> = {
    romance: "neon_romance",
    relationship: "relationship_drama",
    sci_fi: "cyber_neon",
    war: "war_room",
    fantasy: "dark_fantasy",
    political: "court_intrigue",
    mystery: "mystery_board",
    generic: "default_story",
  };
  return themes[profile];
}

function actionStrategy(profile: ScriptProfile): string {
  if (profile === "romance") return "memory_relationship_choice";
  if (profile === "relationship") return "bond_repair_or_break";
  if (profile === "sci_fi") return "system_data_repair";
  if (profile === "war") return "resource_frontline_command";
  if (profile === "political") return "leverage_alliance_public_support";
  if (profile === "fantasy") return "quest_arcane_faction";
  if (profile === "mystery") return "evidence_deduction";
  return "balanced_progression";
}

function metricStyle(profile: ScriptProfile): string {
  if (profile === "romance" || profile === "relationship") return "relationship_bars";
  if (profile === "sci_fi") return "system_diagnostics";
  if (profile === "war") return "operation_dashboard";
  if (profile === "political") return "influence_board";
  return "standard";
}

function timelineMode(profile: ScriptProfile): string {
  if (profile === "romance" || profile === "relationship") return "emotional_reveal";
  if (profile === "sci_fi") return "system_incident";
  if (profile === "war") return "operation_phase";
  if (profile === "political") return "court_session";
  if (profile === "fantasy") return "quest_chapter";
  return "story_event";
}

function evidenceLabel(profile: ScriptProfile): string {
  if (profile === "romance") return "记忆碎片";
  if (profile === "relationship") return "关系线索";
  if (profile === "sci_fi") return "数据证据";
  if (profile === "war") return "情报";
  if (profile === "political") return "筹码";
  return "证据";
}
