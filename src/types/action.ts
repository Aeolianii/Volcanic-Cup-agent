// ============================================================
// Action Types — StructuredAction, RuleResult, etc.
// ============================================================

export interface StructuredAction {
  actor_id: string;
  actor_type: "player" | "npc";
  action_source: "quick_action" | "suggested_action" | "free_action" | "chat" | "npc_planner";
  action_type: ActionType;
  target: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
  raw_input?: string;
  metadata?: Record<string, unknown>;
}

export type ActionCategory = "social" | "investigation" | "political" | "combat" | "resource";

export type ActionType =
  // Social
  | "talk" | "persuade" | "threaten" | "deceive" | "ally" | "betray" | "confess"
  // Investigation
  | "investigate" | "search" | "track" | "eavesdrop" | "interrogate" | "decode" | "spy" | "divination" | "gather_intelligence"
  // Political
  | "command" | "summon_meeting" | "gain_support" | "coup" | "impeach" | "appoint"
  // Combat
  | "attack" | "assassinate" | "duel" | "ambush" | "defend" | "execute" | "sacrifice"
  // Resource
  | "buy" | "trade" | "steal" | "transport" | "build";

export type NPCActionType =
  | "obstruct_investigation"
  | "mislead_player"
  | "hide_evidence"
  | "frame_player"
  | "manipulate_metric"
  | "influence_npc"
  | "protect_secret"
  | "accelerate_plan"
  | ActionType;

export const ACTION_CATEGORIES: Record<ActionCategory, ActionType[]> = {
  social: ["talk", "persuade", "threaten", "deceive", "ally", "betray", "confess"],
  investigation: ["investigate", "search", "track", "eavesdrop", "interrogate", "decode", "spy", "divination", "gather_intelligence"],
  political: ["command", "summon_meeting", "gain_support", "coup", "impeach", "appoint"],
  combat: ["attack", "assassinate", "duel", "ambush", "defend", "execute", "sacrifice"],
  resource: ["buy", "trade", "steal", "transport", "build"],
};

export function getActionCategory(actionType: ActionType): ActionCategory {
  for (const [category, types] of Object.entries(ACTION_CATEGORIES)) {
    if ((types as ActionType[]).includes(actionType)) {
      return category as ActionCategory;
    }
  }
  return "social";
}

export interface RuleResult {
  success: boolean;
  action_id: string;
  state_updates: StateUpdate[];
  public_result: string;
  private_result: string;
  roll?: RollResult;
}

export interface StateUpdate {
  type: StateUpdateType;
  target?: string;
  fact_id?: string;
  metric?: string;
  delta?: number;
  value?: unknown;
  flag?: string;
  modifier?: ActiveModifier;
  npc_runtime?: Partial<NPCRuntimeState>;
  known_player_action?: KnownPlayerAction;
  memory?: MemoryEntry;
  fact?: FactEntry;
  relationship?: {
    source: string;
    target: string;
    type: string;
    delta: number;
  };
}

export type StateUpdateType =
  | "add_known_fact"
  | "remove_known_fact"
  | "metric_change"
  | "set_flag"
  | "clear_flag"
  | "relationship_change"
  | "add_evidence"
  | "trigger_event"
  | "change_location"
  | "reveal_information"
  | "add_active_modifier"
  | "update_npc_runtime"
  | "append_npc_memory"
  | "add_npc_fact"
  | "add_npc_suspected_fact"
  | "record_known_player_action"
  | "add_discovered_clue"
  | "add_false_information"
  | "unlock_private_chat"
  | "set_character_status"
  | "update_faction_state"
  | "record_balance_event";

export interface RollResult {
  dice: number;
  threshold: number;
  modifiers: Modifier[];
}

export interface Modifier {
  source: string;
  value: number;
  reason: string;
}

export interface ActionProposal {
  npc_id: string;
  intention: string;
  action_type: NPCActionType;
  target: string;
  method: string;
  reasoning_visible: string;
  risk_level: "low" | "medium" | "high";
  requires_rule_check: boolean;
  visibility?: "public" | "partial" | "secret";
  effect?: NPCActionEffect;
}

export interface NPCActionEffect {
  type:
    | "success_rate_modifier"
    | "metric_change"
    | "relationship_change"
    | "knowledge_change"
    | "false_evidence"
    | "none";
  target_action_type?: ActionType;
  target_location?: string;
  target_player_id?: string;
  evidence_id?: string;
  metric?: string;
  delta?: number;
  duration_turns?: number;
}

export interface ActiveModifier {
  id: string;
  source: string;
  target_type: "action_type" | "metric" | "relationship" | "location";
  target: string;
  location?: string;
  delta: number;
  remaining_turns: number;
  reason?: string;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  source: string;
  importance: number;
  content: string;
}

export interface FactEntry {
  id: string;
  source: string;
  confidence: number;
  content: string;
}

export interface NPCRelationshipSnapshot {
  target_id: string;
  type: string;
  value: number;
}

export interface KnownPlayerAction {
  actor_id: string;
  action_type: ActionType;
  target: string;
  method: string;
  intent: string;
  turn: number;
  public_summary: string;
}

export interface NPCRuntimeState {
  npc_id: string;
  core_goal: string;
  current_goal: string;
  current_plan: string;
  action_cooldown: number;
  action_frequency: number;
  last_action_turn: number;
  current_intention: string;
  known_facts: FactEntry[];
  suspected_facts: FactEntry[];
  relationships: NPCRelationshipSnapshot[];
  suspicion_towards_players: Record<string, number>;
  known_player_actions: KnownPlayerAction[];
  intervention_strategy: string;
  threat_targets: string[];
  protected_secrets: string[];
  active_modifiers: ActiveModifier[];
  memory_log: MemoryEntry[];
  consecutive_target_id?: string;
  consecutive_target_count?: number;
}
