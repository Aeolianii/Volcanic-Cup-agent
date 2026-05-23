import type { WorldState, StateUpdate, MetricState, EventState, RelationshipState, LocationState, PlayerKnowledge, NPCKnowledge } from "@/types";
import type { StoryBible } from "@/types";

/**
 * World State Engine
 * Maintains the single source of truth for world state.
 * ALL state changes MUST go through applyUpdates().
 */
export function createWorldState(
  storyId: string,
  roomId: string,
  bible: StoryBible
): WorldState {
  const metrics: MetricState[] = bible.metrics.map((m) => ({
    metric_id: m.id,
    value: m.initial,
  }));

  const events: EventState[] = bible.events.map((e) => ({
    event_id: e.id,
    triggered: false,
    resolved: false,
  }));

  const locations: LocationState[] = [
    {
      id: "throne_room",
      name: "王座大厅",
      description: "辉煌的王座大厅，国王在此接见臣民",
      present_characters: [],
      connected_locations: ["temple", "cathedral_basement", "royal_library"],
      flags: {},
    },
    {
      id: "temple",
      name: "圣殿",
      description: "庄严的圣殿，圣杯曾在此供奉",
      present_characters: [],
      connected_locations: ["throne_room", "cathedral_basement", "underground_altar"],
      flags: {},
    },
    {
      id: "cathedral_basement",
      name: "教堂地下室",
      description: "阴暗潮湿的地下室，藏着不为人知的秘密",
      present_characters: [],
      connected_locations: ["temple", "underground_altar"],
      flags: { restricted: true },
    },
    {
      id: "underground_altar",
      name: "地下祭坛",
      description: "隐藏在教堂之下的古老祭坛",
      present_characters: [],
      connected_locations: ["temple", "cathedral_basement"],
      flags: { hidden: true },
    },
    {
      id: "royal_library",
      name: "皇家图书馆",
      description: "藏有大量古籍和秘密档案的图书馆",
      present_characters: [],
      connected_locations: ["throne_room"],
      flags: {},
    },
    {
      id: "city_streets",
      name: "王城街道",
      description: "繁华的王城街道，各色人等穿梭其中",
      present_characters: [],
      connected_locations: ["throne_room", "temple", "tavern"],
      flags: {},
    },
    {
      id: "tavern",
      name: "乌鸦酒馆",
      description: "雇佣兵和情报贩子聚集的酒馆",
      present_characters: [],
      connected_locations: ["city_streets"],
      flags: {},
    },
  ];

  const relationships: RelationshipState[] = [];

  const playerKnowledge: Record<string, PlayerKnowledge> = {};
  for (const role of bible.roles) {
    playerKnowledge[role.id] = {
      player_id: role.id,
      known_facts: [...role.initial_knowledge],
      known_npcs: [],
      known_locations: [role.starting_location],
      known_events: [],
      evidence: [],
    };
  }

  const npcKnowledge: Record<string, NPCKnowledge> = {};
  for (const npc of bible.npcs) {
    npcKnowledge[npc.id] = {
      npc_id: npc.id,
      known_facts: [...npc.initial_knowledge],
      known_events: [],
      known_players: [],
      relationships: {},
      suspicions: {},
    };
  }

  return {
    story_id: storyId,
    room_id: roomId,
    chapter: 1,
    turn: 0,
    flags: {},
    metrics,
    events,
    relationships,
    locations,
    knowledge_state: {
      player_knowledge: playerKnowledge,
      npc_knowledge: npcKnowledge,
      public_knowledge: [],
    },
  };
}

export function applyUpdates(state: WorldState, updates: StateUpdate[]): WorldState {
  const next = structuredClone(state);

  for (const update of updates) {
    switch (update.type) {
      case "add_known_fact": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk && !pk.known_facts.includes(update.fact_id)) {
            pk.known_facts.push(update.fact_id);
          }
          // Also check NPC knowledge
          const nk = next.knowledge_state.npc_knowledge[update.target];
          if (nk && !nk.known_facts.includes(update.fact_id)) {
            nk.known_facts.push(update.fact_id);
          }
        }
        break;
      }
      case "remove_known_fact": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk) {
            pk.known_facts = pk.known_facts.filter((f) => f !== update.fact_id);
          }
        }
        break;
      }
      case "metric_change": {
        if (update.metric && update.delta !== undefined) {
          const m = next.metrics.find((x) => x.metric_id === update.metric);
          if (m && typeof m.value === "number") {
            m.value = Math.max(0, Math.min(100, (m.value as number) + update.delta));
          }
        }
        break;
      }
      case "set_flag": {
        if (update.flag) {
          next.flags[update.flag] = true;
        }
        break;
      }
      case "clear_flag": {
        if (update.flag) {
          next.flags[update.flag] = false;
        }
        break;
      }
      case "relationship_change": {
        if (update.relationship) {
          const { source, target, type, delta } = update.relationship;
          const existing = next.relationships.find(
            (r) => r.source_id === source && r.target_id === target && r.type === type
          );
          if (existing) {
            existing.value = Math.max(-100, Math.min(100, existing.value + delta));
          } else {
            next.relationships.push({
              id: `rel_${source}_${target}_${type}`,
              source_id: source,
              target_id: target,
              type: type as RelationshipState["type"],
              value: delta,
            });
          }
        }
        break;
      }
      case "add_evidence": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk && !pk.evidence.includes(update.fact_id)) {
            pk.evidence.push(update.fact_id);
          }
        }
        break;
      }
      case "trigger_event": {
        if (update.target) {
          const evt = next.events.find((e) => e.event_id === update.target);
          if (evt) {
            evt.triggered = true;
            evt.trigger_turn = next.turn;
          }
        }
        break;
      }
      case "change_location": {
        if (update.target && update.value && typeof update.value === "string") {
          // Move character to new location
          for (const loc of next.locations) {
            loc.present_characters = loc.present_characters.filter((c) => c !== update.target);
          }
          const newLoc = next.locations.find((l) => l.id === update.value);
          if (newLoc) {
            newLoc.present_characters.push(update.target);
          }
        }
        break;
      }
      case "reveal_information": {
        if (update.target && update.value) {
          next.knowledge_state.public_knowledge.push(update.value as string);
        }
        break;
      }
    }
  }

  return next;
}

export function getMetricValue(state: WorldState, metricId: string): number | boolean | string | undefined {
  return state.metrics.find((m) => m.metric_id === metricId)?.value;
}

export function isFlagSet(state: WorldState, flag: string): boolean {
  return state.flags[flag] === true;
}

export function getPlayerKnowledge(state: WorldState, playerId: string): PlayerKnowledge | undefined {
  return state.knowledge_state.player_knowledge[playerId];
}

export function getNPCKnowledge(state: WorldState, npcId: string): NPCKnowledge | undefined {
  return state.knowledge_state.npc_knowledge[npcId];
}
