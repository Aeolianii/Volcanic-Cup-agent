// ============================================================
// WorldState & Room Types
// ============================================================

import type { ActiveModifier, NPCRuntimeState } from "./action";
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
  active_modifiers: ActiveModifier[];
  npc_runtime_state: Record<string, NPCRuntimeState>;
  knowledge_state: KnowledgeState;
  character_states: Record<string, CharacterRuntimeState>;
  faction_states: Record<string, FactionRuntimeState>;
  communication_state: CommunicationState;
  balance_state: BalanceState;
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
  discovered_facts: DiscoverFactEvent[];
  false_information: FalseInformation[];
}

export interface PlayerKnowledge {
  player_id: string;
  known_facts: string[];
  known_npcs: string[];
  known_locations: string[];
  known_events: string[];
  evidence: string[];
  discovered_clues: string[];
  private_chat_unlocked_with: string[];
}

export interface NPCKnowledge {
  npc_id: string;
  known_facts: string[];
  known_events: string[];
  known_players: string[];
  known_player_actions: import("./action").KnownPlayerAction[];
  relationships: Record<string, number>;
  suspicions: Record<string, string>;
  discovered_clues: string[];
}

export type CharacterLifeStatus = "alive" | "dead" | "missing" | "imprisoned" | "defeated" | "setback";

export interface CharacterRuntimeState {
  character_id: string;
  status: CharacterLifeStatus;
  ghost_mode: boolean;
  death_source?: string;
  status_reason?: string;
  consequence_label?: string;
}

export interface FactionRuntimeState {
  faction_id: string;
  power: number;
  resources: number;
  public_support: number;
  hidden_information: string[];
}

export interface CommunicationState {
  unlocked_private_chats: PrivateChatUnlock[];
  channel_membership: Record<string, string[]>;
}

export interface PrivateChatUnlock {
  participants: [string, string];
  reason: string;
  unlocked_turn: number;
}

export interface DiscoverFactEvent {
  fact_id: string;
  discoverer_id: string;
  source_action: string;
  turn: number;
  confidence: number;
}

export interface FalseInformation {
  id: string;
  target_id: string;
  content: string;
  source_action: string;
  turn: number;
  confidence: number;
}

export interface PlayerAdvantageScore {
  player_id: string;
  score: number;
  factors: Record<string, number>;
}

export interface BalanceState {
  player_advantage_scores: PlayerAdvantageScore[];
  last_balance_turn: number;
  recent_events: string[];
}
