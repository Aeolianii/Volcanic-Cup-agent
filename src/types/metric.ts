// ============================================================
// Metric & Event & Ending Types
// ============================================================

export interface Metric {
  id: string;
  label: string;
  type: "number" | "boolean" | "text";
  scope: "global" | "role" | "faction" | "relationship";
  min?: number;
  max?: number;
  initial: number | boolean | string;
  visibility: "public" | "hidden" | "conditional";
  visibility_condition?: string;
}

export interface MetricState {
  metric_id: string;
  value: number | boolean | string;
}

export interface StoryEvent {
  id: string;
  title: string;
  description: string;
  trigger: EventTrigger;
  effects: EventEffect[];
  visibility: "public" | "hidden" | "conditional";
  triggered: boolean;
  chapter_id?: string;
}

export interface EventTrigger {
  type: "metric_threshold" | "flag_set" | "action_performed" | "turn_reached" | "composite";
  conditions: TriggerCondition[];
  operator?: "and" | "or";
}

export interface TriggerCondition {
  field: string;
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists";
  value: unknown;
}

export interface EventEffect {
  type: "set_flag" | "modify_metric" | "add_knowledge" | "reveal_event" | "spawn_npc" | "change_location";
  target: string;
  value: unknown;
}

export interface Ending {
  id: string;
  title: string;
  description: string;
  conditions: EndingCondition[];
  priority: number;
  narrative_prompt: string;
}

export interface EndingCondition {
  type: "metric_threshold" | "flag_set" | "event_triggered" | "relationship_value" | "composite";
  metric_id?: string;
  flag?: string;
  event_id?: string;
  operator: "eq" | "gt" | "lt" | "gte" | "lte";
  value: unknown;
}
