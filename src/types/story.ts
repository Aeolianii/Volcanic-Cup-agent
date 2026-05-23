// ============================================================
// Core Story Types — StorySeed, StoryBible, Roles, NPCs, etc.
// ============================================================

export interface StorySeed {
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  world_setting: string;
  source_type: "manual" | "ai_generated";
}

export interface StoryBible {
  id: string;
  title: string;
  version: number;
  world_setting: WorldSetting;
  roles: Role[];
  npcs: NPC[];
  factions: Faction[];
  chapters: Chapter[];
  events: StoryEvent[];
  endings: Ending[];
  metrics: Metric[];
  rules: RulePackRef[];
  knowledge: KnowledgeEntry[];
  ui_config: UIConfig;
}

export interface WorldSetting {
  era: string;
  location: string;
  atmosphere: string;
  magic_system?: string;
  technology_level?: string;
  special_rules?: string[];
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  goals: string[];
  members: string[];
  relationships: Record<string, number>;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  description: string;
  entry_conditions: string[];
  key_events: string[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: "public" | "hidden" | "clue" | "secret";
  known_by: string[];
  revealed: boolean;
}

export interface RulePackRef {
  pack_id: string;
  pack_type: string;
  enabled: boolean;
}

export interface UIConfig {
  theme: string;
  layout: "default" | "split" | "focus";
  widgets: WidgetConfig[];
  display_metrics: string[];
}

export interface WidgetConfig {
  key: string;
  position: "top" | "left" | "center" | "right" | "bottom";
  order: number;
  visible: boolean;
  props?: Record<string, unknown>;
}
