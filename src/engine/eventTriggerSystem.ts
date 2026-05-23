import type { WorldState, StoryBible, StoryEvent, EventTrigger, TriggerCondition } from "@/types";

export interface TriggeredEvent {
  event: StoryEvent;
  trigger_reason: string;
}

export function checkEventTriggers(
  state: WorldState,
  bible: StoryBible
): TriggeredEvent[] {
  const triggered: TriggeredEvent[] = [];

  for (const event of bible.events) {
    // Skip already triggered events
    const eventState = state.events.find((e) => e.event_id === event.id);
    if (eventState?.triggered) continue;

    if (evaluateTrigger(event.trigger, state)) {
      triggered.push({
        event,
        trigger_reason: buildTriggerReason(event.trigger, state),
      });
    }
  }

  return triggered;
}

function evaluateTrigger(trigger: EventTrigger, state: WorldState): boolean {
  if (trigger.type === "composite" && trigger.operator) {
    const results = trigger.conditions.map((c) => evaluateCondition(c, state));
    return trigger.operator === "and"
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  return trigger.conditions.every((c) => evaluateCondition(c, state));
}

function evaluateCondition(condition: TriggerCondition, state: WorldState): boolean {
  const { field, operator, value } = condition;

  // Check metrics
  const metric = state.metrics.find((m) => m.metric_id === field);
  if (metric) {
    return compareValues(metric.value, operator, value as number);
  }

  // Check flags
  if (field in state.flags) {
    const flagVal = state.flags[field];
    if (operator === "exists") return flagVal === true;
    return compareValues(flagVal, operator, value);
  }

  if (field.startsWith("flag_")) {
    const flagName = field.replace(/^flag_/, "");
    const flagVal = state.flags[flagName];
    if (operator === "exists") return flagVal === true;
    return compareValues(flagVal, operator, value);
  }

  // Check turn
  if (field === "turn") {
    return compareValues(state.turn, operator, value as number);
  }

  // Check chapter
  if (field === "chapter") {
    return compareValues(state.chapter, operator, value as number);
  }

  // Check if event was triggered
  if (field.startsWith("event_")) {
    const eventId = field.replace("event_", "");
    const evt = state.events.find((e) => e.event_id === eventId);
    if (operator === "exists") return evt?.triggered === true;
    return evt?.triggered === value;
  }

  return false;
}

function compareValues(a: unknown, operator: string, b: unknown): boolean {
  switch (operator) {
    case "eq": return a === b;
    case "gt": return (a as number) > (b as number);
    case "lt": return (a as number) < (b as number);
    case "gte": return (a as number) >= (b as number);
    case "lte": return (a as number) <= (b as number);
    case "contains": return String(a).includes(String(b));
    case "exists": return a !== undefined && a !== null;
    default: return false;
  }
}

function buildTriggerReason(trigger: EventTrigger, _state: WorldState): string {
  const conditions = trigger.conditions
    .map((c) => `${c.field} ${c.operator} ${c.value}`)
    .join(trigger.operator === "or" ? " 或 " : " 且 ");
  return `条件满足: ${conditions}`;
}
