import type {
  AIProvider,
  GMContext,
  GMNarrativeOutput,
  StoryBible,
  WorldState,
} from "@/types";

/**
 * AI GM Module
 * AI GM can READ the full Story Bible and World State.
 * AI GM CANNOT directly modify World State — only outputs
 * narration, suggested_events, and revealed_information.
 */
export async function generateGMNarrative(
  bible: StoryBible,
  state: WorldState,
  aiProvider: AIProvider,
  phase: "opening" | "chapter_start" | "turn_narration" | "event_narration" | "ending"
): Promise<GMNarrativeOutput> {
  const context = buildGMContext(bible, state, phase);

  try {
    const output = await aiProvider.generateNarrative(context);
    if (output) return output;
  } catch {
    // Fall through to template-based narrative
  }

  return templateNarrative(bible, state, phase);
}

function buildGMContext(
  bible: StoryBible,
  state: WorldState,
  phase: string
): GMContext {
  const currentChapter = bible.chapters.find((c) => c.order === state.chapter);

  return {
    story_bible: {
      title: bible.title,
      world_setting: bible.world_setting.atmosphere,
      roles: bible.roles.map((r) => ({
        id: r.id,
        name: r.name,
        public_identity: r.public_identity,
      })),
      npcs: bible.npcs.map((n) => ({
        id: n.id,
        name: n.name,
        public_identity: n.public_identity,
      })),
      chapters: bible.chapters.map((c) => ({ id: c.id, title: c.title })),
      current_chapter_events: currentChapter?.key_events || [],
    },
    world_state_summary: {
      flags: state.flags,
      metrics: state.metrics.map((m) => ({
        id: m.metric_id,
        label: m.metric_id,
        value: m.value,
      })),
      active_events: state.events.filter((e) => e.triggered).map((e) => e.event_id),
      player_locations: Object.fromEntries(
        state.locations
          .filter((l) => l.present_characters.length > 0)
          .flatMap((l) => l.present_characters.map((c) => [c, l.id]))
      ),
    },
    recent_events: state.events
      .filter((e) => e.triggered)
      .map((e) => e.event_id),
    current_turn: state.turn,
    current_chapter: state.chapter,
  };
}

function templateNarrative(
  bible: StoryBible,
  state: WorldState,
  phase: string
): GMNarrativeOutput {
  const currentChapter = bible.chapters.find((c) => c.order === state.chapter);

  switch (phase) {
    case "opening":
      return {
        narration: `夜幕降临在${bible.world_setting.location}。${bible.world_setting.atmosphere}\n\n${
          currentChapter?.description || "故事即将开始..."
        }\n\n第 ${state.chapter} 章：${currentChapter?.title || "序幕"}\n\n各怀心思的人们聚集于此，命运的齿轮开始转动...`,
        suggested_events: currentChapter?.key_events || [],
        revealed_information: [
          {
            type: "fact",
            title: "世界设定",
            content: bible.world_setting.atmosphere,
            visible_to: ["all"],
          },
        ],
        suggested_actions: [
          {
            label: "观察周围",
            action_type: "investigate",
            target: "surroundings",
            method: "observe",
            intent: "gather_information",
            risk_level: "low",
            context: "初到此处，先了解环境",
          },
          {
            label: "与其他角色交谈",
            action_type: "talk",
            target: "other_characters",
            method: "conversation",
            intent: "learn_more",
            risk_level: "low",
            context: "了解其他人的立场",
          },
        ],
        mood: "mysterious",
      };

    case "turn_narration":
      return {
        narration: buildTurnNarration(state),
        suggested_events: [],
        revealed_information: [],
        suggested_actions: generateContextualActions(state, bible),
        mood: "tense",
      };

    case "event_narration": {
      const lastTriggeredEvent = state.events.find((e) => e.triggered);
      const eventDetail = bible.events.find((e) => e.id === lastTriggeredEvent?.event_id);

      return {
        narration: eventDetail
          ? `【事件触发】${eventDetail.title}\n\n${eventDetail.description}`
          : "新的发展出现了...",
        suggested_events: [],
        revealed_information: eventDetail
          ? [
              {
                type: "event",
                title: eventDetail.title,
                content: eventDetail.description,
                visible_to: eventDetail.visibility === "public" ? ["all"] : [],
              },
            ]
          : [],
        suggested_actions: [],
        mood: "dramatic",
      };
    }

    case "ending":
      return {
        narration: "故事迎来了它的结局...",
        suggested_events: [],
        revealed_information: [],
        suggested_actions: [],
        mood: "climactic",
      };

    default:
      return {
        narration: "",
        suggested_events: [],
        revealed_information: [],
        suggested_actions: [],
        mood: "neutral",
      };
  }
}

function buildTurnNarration(state: WorldState): string {
  const triggeredEvents = state.events.filter((e) => e.triggered && !e.resolved);
  const eventMentions = triggeredEvents.length > 0
    ? `\n当前事件：${triggeredEvents.map((e) => e.event_id).join("、")}`
    : "";

  return `第 ${state.turn} 回合${eventMentions}\n局势正在发展，每个人都需要做出选择...`;
}

function generateContextualActions(
  state: WorldState,
  _bible: StoryBible
): GMNarrativeOutput["suggested_actions"] {
  const actions: GMNarrativeOutput["suggested_actions"] = [];

  // Always offer basic actions
  actions.push({
    label: "调查当前区域",
    action_type: "investigate",
    target: state.locations.find((l) => l.present_characters.length > 0)?.id || "current_location",
    method: "examine",
    intent: "gather_information",
    risk_level: "low",
    context: "了解更多当前区域的信息",
  });

  // If there are triggered events, suggest related actions
  const triggeredEvents = state.events.filter((e) => e.triggered);
  if (triggeredEvents.length > 0) {
    actions.push({
      label: "深入调查事件",
      action_type: "investigate",
      target: triggeredEvents[0].event_id,
      method: "deep_investigation",
      intent: "understand_event",
      risk_level: "medium",
      context: "深入了解当前发生的事件",
    });
  }

  // If NPCs present, suggest interaction
  const populatedLocations = state.locations.filter((l) => l.present_characters.length > 1);
  if (populatedLocations.length > 0) {
    const otherChars = populatedLocations[0].present_characters.slice(0, 2);
    if (otherChars.length > 0) {
      actions.push({
        label: `与 ${otherChars[0]} 交谈`,
        action_type: "talk",
        target: otherChars[0],
        method: "conversation",
        intent: "learn_more",
        risk_level: "low",
        context: "获取更多信息",
      });
    }
  }

  return actions;
}
