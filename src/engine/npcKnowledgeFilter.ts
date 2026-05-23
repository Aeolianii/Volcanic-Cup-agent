import type { WorldState, NPC, StoryBible, NPCLocalView } from "@/types";

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
    return {
      known_facts: [...npc.initial_knowledge],
      known_events: [],
      known_players: [],
      relationships: {},
      recent_actions: [],
    };
  }

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
      ...state.knowledge_state.public_knowledge,
    ],
    known_events: [
      ...npcKnowledge.known_events,
      ...publicEvents,
    ],
    known_players: knownPlayers,
    relationships,
    recent_actions: [],
  };
}
