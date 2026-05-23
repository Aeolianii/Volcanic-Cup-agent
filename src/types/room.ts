// ============================================================
// Room & Player Types
// ============================================================

import type { Role } from "./role";

export interface Room {
  room_id: string;
  story_bible_id: string;
  world_state_id: string;
  players: Player[];
  status: RoomStatus;
  created_at: string;
  owner_id: string;
  max_players: number;
}

export type RoomStatus = "waiting" | "ready" | "running" | "paused" | "finished";

export interface Player {
  player_id: string;
  name: string;
  role_id: string | null;
  role: Role | null;
  joined_at: string;
  is_owner: boolean;
  is_ready: boolean;
}

export interface PlayerView {
  role_sheet: Role | null;
  known_facts: string[];
  known_npcs: string[];
  known_locations: string[];
  visible_metrics: VisibleMetric[];
  active_events: ActiveEvent[];
  suggested_actions: SuggestedAction[];
}

export interface VisibleMetric {
  metric_id: string;
  label: string;
  value: number | boolean | string;
  type: "number" | "boolean" | "text";
}

export interface ActiveEvent {
  event_id: string;
  title: string;
  description: string;
  turn_triggered: number;
}

export interface SuggestedAction {
  id: string;
  label: string;
  action_type: string;
  target: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
  context: string;
}
