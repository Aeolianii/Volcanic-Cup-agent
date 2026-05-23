// ============================================================
// Action Types — StructuredAction, RuleResult, etc.
// ============================================================

export interface StructuredAction {
  actor_id: string;
  actor_type: "player" | "npc";
  action_source: "quick_action" | "suggested_action" | "free_action" | "chat";
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
  | "investigate" | "search" | "track" | "eavesdrop" | "interrogate" | "decode"
  // Political
  | "command" | "summon_meeting" | "gain_support" | "coup" | "impeach" | "appoint"
  // Combat
  | "attack" | "assassinate" | "duel" | "ambush" | "defend"
  // Resource
  | "buy" | "trade" | "steal" | "transport" | "build";

export const ACTION_CATEGORIES: Record<ActionCategory, ActionType[]> = {
  social: ["talk", "persuade", "threaten", "deceive", "ally", "betray", "confess"],
  investigation: ["investigate", "search", "track", "eavesdrop", "interrogate", "decode"],
  political: ["command", "summon_meeting", "gain_support", "coup", "impeach", "appoint"],
  combat: ["attack", "assassinate", "duel", "ambush", "defend"],
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
  | "reveal_information";

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
  action_type: ActionType;
  target: string;
  method: string;
  reasoning_visible: string;
  risk_level: "low" | "medium" | "high";
  requires_rule_check: boolean;
}
