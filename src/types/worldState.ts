// ============================================================
// WorldState & Room Types
// ============================================================

import type { MetricState } from "./metric";

export interface WorldState {
  story_id: string;
  room_id: string;
  chapter: number;
  turn: number;
  flags: Record<string, boolean>;
  metrics: MetricState[];
  events: EventState[];
  relationships: RelationshipState[];
  locations: LocationState[];
  knowledge_state: KnowledgeState;
}

export interface EventState {
  event_id: string;
  triggered: boolean;
  trigger_turn?: number;
  resolved: boolean;
}

export interface RelationshipState {
  id: string;
  source_id: string;
  target_id: string;
  type: "trust" | "suspicion" | "alliance" | "hostility" | "neutral";
  value: number; // -100 to 100
}

export interface LocationState {
  id: string;
  name: string;
  description: string;
  present_characters: string[];
  connected_locations: string[];
  flags: Record<string, boolean>;
}

export interface KnowledgeState {
  player_knowledge: Record<string, PlayerKnowledge>;
  npc_knowledge: Record<string, NPCKnowledge>;
  public_knowledge: string[];
}

export interface PlayerKnowledge {
  player_id: string;
  known_facts: string[];
  known_npcs: string[];
  known_locations: string[];
  known_events: string[];
  evidence: string[];
}

export interface NPCKnowledge {
  npc_id: string;
  known_facts: string[];
  known_events: string[];
  known_players: string[];
  relationships: Record<string, number>;
  suspicions: Record<string, string>;
}
