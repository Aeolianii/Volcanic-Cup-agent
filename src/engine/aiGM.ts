import type {
  AIProvider,
  GMContext,
  GMNarrativeOutput,
  StoryBible,
  WorldState,
} from "@/types";

/**
 * AI GM can read Story Bible and World State, but can only output narration,
 * suggested events, revealed information and suggested actions.
 */
export async function generateGMNarrative(
  bible: StoryBible,
  state: WorldState,
  aiProvider: AIProvider,
  phase: "opening" | "chapter_start" | "turn_narration" | "event_narration" | "ending"
): Promise<GMNarrativeOutput> {
  const context = buildGMContext(bible, state);

  try {
    const output = await aiProvider.generateNarrative(context);
    if (isUsableNarrative(output)) return output;
  } catch {
    // Keep the game playable when the provider is unavailable.
  }

  return templateNarrative(bible, state, phase);
}

function buildGMContext(bible: StoryBible, state: WorldState): GMContext {
  const currentChapter = bible.chapters.find((chapter) => chapter.order === state.chapter);

  return {
    story_bible: {
      title: bible.title,
      world_setting: bible.world_setting.atmosphere,
      roles: bible.roles.map((role) => ({
        id: role.id,
        name: role.name,
        public_identity: role.public_identity,
      })),
      npcs: bible.npcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        public_identity: npc.public_identity,
      })),
      chapters: bible.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
      current_chapter_events: currentChapter?.key_events || [],
    },
    world_state_summary: {
      flags: state.flags,
      metrics: state.metrics.map((metric) => ({
        id: metric.metric_id,
        label: metric.metric_id,
        value: metric.value,
      })),
      active_events: state.events.filter((event) => event.triggered).map((event) => event.event_id),
      player_locations: Object.fromEntries(
        state.locations
          .filter((location) => location.present_characters.length > 0)
          .flatMap((location) => location.present_characters.map((character) => [character, location.id]))
      ),
    },
    recent_events: state.events.filter((event) => event.triggered).map((event) => event.event_id),
    current_turn: state.turn,
    current_chapter: state.chapter,
  };
}

function isUsableNarrative(output: GMNarrativeOutput | null | undefined): output is GMNarrativeOutput {
  return Boolean(output?.narration && Array.isArray(output.suggested_actions));
}

function templateNarrative(
  bible: StoryBible,
  state: WorldState,
  phase: string
): GMNarrativeOutput {
  const currentChapter = bible.chapters.find((chapter) => chapter.order === state.chapter);
  const activeEvents = state.events
    .filter((event) => event.triggered)
    .map((event) => bible.events.find((storyEvent) => storyEvent.id === event.event_id))
    .filter(Boolean);

  if (phase === "opening") {
    return {
      narration: [
        `# ${bible.title}`,
        bible.world_setting.atmosphere,
        currentChapter ? `当前章节：${currentChapter.title}` : "故事即将开始。",
        currentChapter?.description || "",
        "你的角色已经入场。现在的每一步行动都会改变局势、关系和结局判断。",
      ].filter(Boolean).join("\n\n"),
      suggested_events: currentChapter?.key_events || [],
      revealed_information: [
        {
          type: "fact",
          title: "世界背景",
          content: bible.world_setting.atmosphere,
          visible_to: ["all"],
        },
      ],
      suggested_actions: generateContextualActions(state, bible),
      mood: "opening",
    };
  }

  if (phase === "event_narration") {
    const latestEvent = activeEvents[activeEvents.length - 1];
    return {
      narration: latestEvent
        ? `【事件推进】${latestEvent.title}\n\n${latestEvent.description}`
        : "新的发展正在浮现，局势开始偏离原本的轨道。",
      suggested_events: [],
      revealed_information: latestEvent
        ? [{
            type: "event",
            title: latestEvent.title,
            content: latestEvent.description,
            visible_to: latestEvent.visibility === "public" ? ["all"] : [],
          }]
        : [],
      suggested_actions: generateContextualActions(state, bible),
      mood: "dramatic",
    };
  }

  return {
    narration: [
      `第 ${state.turn} 回合`,
      activeEvents.length > 0
        ? `当前事件：${activeEvents.map((event) => event?.title).join("、")}`
        : "局势仍在酝酿，尚未出现公开事件。",
      "请根据你的公开目标、秘密目标和已知情报选择下一步行动。",
    ].join("\n\n"),
    suggested_events: [],
    revealed_information: [],
    suggested_actions: generateContextualActions(state, bible),
    mood: "tense",
  };
}

function generateContextualActions(
  state: WorldState,
  bible: StoryBible
): GMNarrativeOutput["suggested_actions"] {
  const firstVisibleEvent = bible.events.find((event) => {
    const eventState = state.events.find((item) => item.event_id === event.id);
    return event.visibility === "public" && (!eventState || eventState.triggered);
  }) || bible.events[0];

  const firstNpc = bible.npcs[0];
  const currentTarget = state.locations.find((location) => location.present_characters.length > 0)?.id || "current_location";

  const actions: GMNarrativeOutput["suggested_actions"] = [
    {
      label: "调查当前线索",
      action_type: "investigate",
      target: firstVisibleEvent?.id || currentTarget,
      method: "focused_inquiry",
      intent: "find_clues",
      risk_level: "low",
      context: firstVisibleEvent
        ? `围绕“${firstVisibleEvent.title}”寻找更多证据`
        : "先确认当前地点有哪些可用信息",
    },
    {
      label: "梳理角色目标",
      action_type: "investigate",
      target: "self_goal",
      method: "reflect",
      intent: "plan_next_move",
      risk_level: "low",
      context: "把公开目标与秘密目标转化为下一步计划",
    },
  ];

  if (firstNpc) {
    actions.push({
      label: `试探${firstNpc.name}`,
      action_type: "talk",
      target: firstNpc.id,
      method: "careful_conversation",
      intent: "gather_information",
      risk_level: "medium",
      context: `${firstNpc.public_identity}，可能掌握与你当前处境相关的信息`,
    });
  }

  return actions;
}
