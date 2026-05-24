import type { WorldState, NPC, StoryBible, NPCLocalView } from "@/types";
import type { NPCRuntimeState } from "@/types";
import { createInitialNPCRuntime } from "./worldStateEngine";

/**
 * NPC Knowledge Filter / Perspective Builder
 * Constructs a limited local view for each NPC.
 *
 * NPCs CAN see:
 * - Their own goals, secret goals, memory
 * - Their known facts
 * - Public events
 * - Their own relationship states
 *
 * NPCs CANNOT see:
 * - Full Story Bible
 * - Ultimate truth
 * - Other NPC secrets
 * - Hidden event trigger conditions
 * - Future chapters
 * - Ending conditions
 * - Player secret actions
 * - Unrevealed clues
 */
export function buildNPCLocalView(
  npc: NPC,
  state: WorldState,
  _bible: StoryBible
): NPCLocalView {
  const npcKnowledge = state.knowledge_state.npc_knowledge[npc.id];

  if (!npcKnowledge) {
    const runtime = getRuntime(npc, state);
    return {
      self_information: [npc.public_identity, npc.goal, npc.secret_goal].filter(Boolean),
      public_information: [...state.knowledge_state.public_knowledge],
      discovered_information: [
        ...runtime.known_facts.map((fact) => fact.content),
        ...runtime.suspected_facts.map((fact) => `疑似：${fact.content}`),
      ],
      known_facts: [...npc.initial_knowledge],
      known_events: [],
      known_players: [],
      relationships: {},
      recent_actions: [],
      current_public_events: [],
      visible_metrics: visibleMetrics(state, _bible),
      observations: [],
      threat_assessment: [],
      runtime,
    };
  }
  const runtime = getRuntime(npc, state);

  // Only include PUBLIC events
  const publicEvents = state.events
    .filter((e) => {
      const bibleEvent = _bible.events.find((be) => be.id === e.event_id);
      return e.triggered && bibleEvent?.visibility === "public";
    })
    .map((e) => e.event_id);

  // Only see players in same location or publicly known
  const knownPlayers = state.locations
    .filter((loc) => loc.present_characters.includes(npc.id))
    .flatMap((loc) =>
      loc.present_characters
        .filter((c) => c !== npc.id)
        .map((c) => ({
          id: c,
          name: c,
          public_identity: "",
          location: loc.id,
        }))
    );

  // Relationships only where this NPC is involved
  const relationships: Record<string, number> = {};
  for (const rel of state.relationships) {
    if (rel.source_id === npc.id) {
      relationships[rel.target_id] = rel.value;
    } else if (rel.target_id === npc.id) {
      relationships[rel.source_id] = rel.value;
    }
  }

  return {
    known_facts: [
      ...npc.initial_knowledge,
      ...npcKnowledge.known_facts,
      ...runtime.known_facts.map((fact) => fact.content),
      ...runtime.suspected_facts.map((fact) => `疑似：${fact.content}`),
      ...state.knowledge_state.public_knowledge,
    ],
    self_information: [npc.public_identity, npc.goal, npc.secret_goal].filter(Boolean),
    public_information: [...state.knowledge_state.public_knowledge],
    discovered_information: [
      ...npcKnowledge.discovered_clues,
      ...runtime.known_facts.map((fact) => fact.content),
      ...runtime.suspected_facts.map((fact) => `疑似：${fact.content}`),
    ],
    known_events: [
      ...npcKnowledge.known_events,
      ...publicEvents,
    ],
    known_players: knownPlayers,
    relationships,
    recent_actions: [
      ...(npcKnowledge.known_player_actions || []),
      ...(state.npc_runtime_state?.[npc.id]?.known_player_actions || []),
    ].slice(-8),
    current_public_events: publicEvents,
    visible_metrics: visibleMetrics(state, _bible),
    observations: buildObservations(runtime),
    threat_assessment: buildThreatAssessment(runtime),
    runtime,
  };
}

function getRuntime(npc: NPC, state: WorldState): NPCRuntimeState {
  return state.npc_runtime_state?.[npc.id] ?? createInitialNPCRuntime(npc);
}

function visibleMetrics(state: WorldState, bible: StoryBible): { id: string; value: unknown }[] {
  return state.metrics
    .filter((metric) => {
      const definition = bible.metrics.find((item) => item.id === metric.metric_id);
      return definition?.visibility === "public" || definition?.visibility === "conditional";
    })
    .map((metric) => ({ id: metric.metric_id, value: metric.value }));
}

function buildObservations(runtime: NPCRuntimeState): string[] {
  return runtime.memory_log
    .filter((memory) => memory.importance >= 50)
    .slice(-8)
    .map((memory) => memory.content);
}

function buildThreatAssessment(runtime: NPCRuntimeState): { target_id: string; level: number; reasons: string[] }[] {
  return Object.entries(runtime.suspicion_towards_players)
    .map(([target_id, level]) => ({
      target_id,
      level,
      reasons: runtime.memory_log
        .filter((memory) => memory.content.includes(target_id))
        .slice(-3)
        .map((memory) => memory.content),
    }))
    .sort((a, b) => b.level - a.level);
}
