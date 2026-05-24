// ============================================================
// Core Story Types — StorySeed, StoryBible, Roles, NPCs, etc.
// ============================================================

import type { Role, NPC } from "./role";
import type { Metric, StoryEvent, Ending } from "./metric";

export interface StorySeed {
  genre: string;
  opening: string;
  ending: string;
  characters: string;
  world_setting: string;
  source_type: "manual" | "ai_generated";
  full_text?: string;
}

export interface StoryBible {
  id: string;
  title: string;
  version: number;
  world_setting: WorldSetting;
  roles: Role[];
  npcs: NPC[];
  factions: Faction[];
  character_models?: CharacterModel[];
  faction_models?: FactionModel[];
  relationship_graph?: RelationshipGraph;
  knowledge_graph?: KnowledgeGraph;
  victory_conditions?: VictoryCondition[];
  runtime_modules?: StoryRuntimeModules;
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

export interface AttributeSchema {
  base: Record<string, number>;
  genre_specific: Record<string, number>;
}

export interface CharacterModel {
  id: string;
  name: string;
  kind: "player" | "npc";
  faction_id?: string;
  public_identity: string;
  attributes: AttributeSchema;
  public_information: string[];
  self_information: string[];
  starting_known_facts: string[];
}

export interface FactionStateModel {
  power: number;
  resources: number;
  public_support: number;
  hidden_information: string[];
}

export interface FactionModel {
  id: string;
  name: string;
  public_members: string[];
  hidden_members: string[];
  state: FactionStateModel;
}

export interface RelationshipGraph {
  edges: RelationshipEdge[];
}

export interface RelationshipEdge {
  source_id: string;
  target_id: string;
  type: "trust" | "suspicion" | "alliance" | "hostility" | "neutral";
  value: number;
  known_by: string[];
}

export interface KnowledgeGraph {
  facts: KnowledgeGraphFact[];
}

export interface KnowledgeGraphFact {
  id: string;
  title: string;
  content: string;
  truth_status: "true" | "false" | "uncertain";
  source: "world_truth" | "public" | "discovery" | "misinformation";
  visibility: "public" | "restricted" | "hidden";
  known_by: string[];
}

export interface VictoryCondition {
  id: string;
  scope: "faction" | "personal";
  owner_id: string;
  description: string;
  condition_refs: string[];
}

export type StoryGenreProfile =
  | "campus_romance"
  | "romance"
  | "comedy"
  | "mystery"
  | "horror"
  | "political_intrigue"
  | "combat_adventure"
  | "workplace"
  | "generic";

export type StoryConsequenceMode =
  | "lethal"
  | "romance_failure"
  | "comic_setback"
  | "social_setback"
  | "investigation_failure";

export interface StoryRuntimeModules {
  genre_profile: StoryGenreProfile;
  tone_tags: string[];
  enabled: {
    knowledge_fog: boolean;
    investigation: boolean;
    misinformation: boolean;
    factions: boolean;
    private_chat: boolean;
    relationship_routes: boolean;
    combat: boolean;
    character_death: boolean;
    ghost_mode: boolean;
    failure_screen: boolean;
    comic_setbacks: boolean;
    gm_balancer: boolean;
    auto_simulation_after_exit: boolean;
  };
  consequence_mode: StoryConsequenceMode;
  disabled_action_types: string[];
  consequence_labels: {
    lethal: string;
    non_lethal: string;
    failed_route: string;
    setback: string;
  };
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
