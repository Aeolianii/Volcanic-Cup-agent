import type { WorldState, StoryBible, Chapter } from "@/types";

export interface ChapterTransition {
  should_transition: boolean;
  from_chapter: number;
  to_chapter: number;
  reason: string;
  new_chapter?: Chapter;
}

export function checkChapterTransition(
  state: WorldState,
  bible: StoryBible
): ChapterTransition {
  const currentChapter = bible.chapters.find((c) => c.order === state.chapter);
  const nextChapter = bible.chapters.find((c) => c.order === state.chapter + 1);

  if (!nextChapter) {
    return {
      should_transition: false,
      from_chapter: state.chapter,
      to_chapter: state.chapter,
      reason: "已是最终章节",
    };
  }

  // Check entry conditions for next chapter
  const conditionsMet = nextChapter.entry_conditions.every((condition) => {
    // Check if key events in current chapter have been triggered
    if (condition.startsWith("event_")) {
      const eventId = condition.replace("event_", "");
      const evt = state.events.find((e) => e.event_id === eventId);
      return evt?.triggered === true;
    }
    // Check flags
    if (condition in state.flags) {
      return state.flags[condition] === true;
    }
    // Check metrics
    const [metricId, op, val] = condition.split(/\s+/);
    const metric = state.metrics.find((m) => m.metric_id === metricId);
    if (metric && typeof metric.value === "number") {
      const threshold = parseInt(val, 10);
      switch (op) {
        case ">=": return metric.value >= threshold;
        case "<=": return metric.value <= threshold;
        case ">": return metric.value > threshold;
        case "<": return metric.value < threshold;
        default: return false;
      }
    }
    return false;
  });

  // Also check: all key events of current chapter should be triggered
  const currentKeyEvents = currentChapter?.key_events || [];
  const allKeyEventsTriggered = currentKeyEvents.every((eventId) => {
    const evt = state.events.find((e) => e.event_id === eventId);
    return evt?.triggered === true;
  });

  const shouldTransition = conditionsMet && allKeyEventsTriggered && state.turn >= 3;

  return {
    should_transition: shouldTransition,
    from_chapter: state.chapter,
    to_chapter: shouldTransition ? state.chapter + 1 : state.chapter,
    reason: shouldTransition
      ? `章节过渡条件满足，进入第 ${state.chapter + 1} 章: ${nextChapter.title}`
      : `尚未满足第 ${state.chapter + 1} 章进入条件`,
    new_chapter: shouldTransition ? nextChapter : undefined,
  };
}
