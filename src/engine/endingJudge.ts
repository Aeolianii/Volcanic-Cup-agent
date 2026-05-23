import type { WorldState, StoryBible, Ending, EndingCondition } from "@/types";

export interface EndingResult {
  reached: boolean;
  ending: Ending | null;
  all_endings_status: EndingStatus[];
}

export interface EndingStatus {
  ending_id: string;
  title: string;
  conditions_met: number;
  total_conditions: number;
  progress: number; // 0-100
}

export function checkEndings(state: WorldState, bible: StoryBible): EndingResult {
  const statuses: EndingStatus[] = [];

  // Sort endings by priority (descending)
  const sortedEndings = [...bible.endings].sort((a, b) => b.priority - a.priority);

  for (const ending of sortedEndings) {
    const met = ending.conditions.filter((c) => evaluateEndingCondition(c, state));
    const progress = ending.conditions.length > 0
      ? Math.round((met.length / ending.conditions.length) * 100)
      : 0;

    statuses.push({
      ending_id: ending.id,
      title: ending.title,
      conditions_met: met.length,
      total_conditions: ending.conditions.length,
      progress,
    });

    // First ending with all conditions met wins (highest priority)
    if (met.length === ending.conditions.length) {
      return {
        reached: true,
        ending,
        all_endings_status: statuses,
      };
    }
  }

  return {
    reached: false,
    ending: null,
    all_endings_status: statuses,
  };
}

function evaluateEndingCondition(
  condition: EndingCondition,
  state: WorldState
): boolean {
  switch (condition.type) {
    case "metric_threshold": {
      const metric = state.metrics.find((m) => m.metric_id === condition.metric_id);
      if (!metric || typeof metric.value !== "number") return false;
      return compareValues(metric.value, condition.operator, condition.value as number);
    }
    case "flag_set": {
      return state.flags[condition.flag!] === true;
    }
    case "event_triggered": {
      const evt = state.events.find((e) => e.event_id === condition.event_id);
      return evt?.triggered === true;
    }
    case "relationship_value": {
      const [sourceId, targetId] = (condition.metric_id || "").split("_with_");
      const rel = state.relationships.find(
        (r) => r.source_id === sourceId && r.target_id === targetId
      );
      if (!rel) return false;
      return compareValues(rel.value, condition.operator, condition.value as number);
    }
    case "composite": {
      // For composite, delegate to individual checks
      return true;
    }
    default:
      return false;
  }
}

function compareValues(a: unknown, operator: string, b: unknown): boolean {
  switch (operator) {
    case "eq": return a === b;
    case "gt": return (a as number) > (b as number);
    case "lt": return (a as number) < (b as number);
    case "gte": return (a as number) >= (b as number);
    case "lte": return (a as number) <= (b as number);
    default: return false;
  }
}
