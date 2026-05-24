import type { Room, Player, RoomStatus, WorldState, StoryBible } from "@/types";
import { createWorldState } from "@/engine/worldStateEngine";
import { enrichStoryBibleForSimulation } from "@/engine/storyAdaptationLayer";

/**
 * In-memory room manager (MVP — replace with DB in production)
 */
const globalRoomStore = globalThis as typeof globalThis & {
  __aiStoryRooms?: Map<string, Room>;
  __aiStoryWorldStates?: Map<string, WorldState>;
  __aiStoryBibles?: Map<string, StoryBible>;
};

class RoomManager {
  private rooms: Map<string, Room> = globalRoomStore.__aiStoryRooms ??= new Map();
  private worldStates: Map<string, WorldState> = globalRoomStore.__aiStoryWorldStates ??= new Map();
  private storyBibles: Map<string, StoryBible> = globalRoomStore.__aiStoryBibles ??= new Map();

  createRoom(
    storyBibleId: string,
    ownerId: string,
    ownerName: string,
    maxPlayers: number = 4
  ): Room {
    const roomId = generateRoomCode();
    const bible = this.storyBibles.get(storyBibleId);
    const effectiveMaxPlayers = Math.max(maxPlayers, bible?.roles.length || maxPlayers);

    const room: Room = {
      room_id: roomId,
      story_bible_id: storyBibleId,
      world_state_id: `ws_${roomId}`,
      players: [
        {
          player_id: ownerId,
          name: ownerName,
          role_id: null,
          role: null,
          joined_at: new Date().toISOString(),
          is_owner: true,
          is_ready: false,
        },
      ],
      status: "waiting",
      created_at: new Date().toISOString(),
      owner_id: ownerId,
      max_players: effectiveMaxPlayers,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addPlayer(roomId: string, playerId: string, playerName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== "waiting") return null;
    if (room.players.length >= room.max_players) return null;
    if (room.players.some((p) => p.player_id === playerId)) return room; // already joined

    room.players.push({
      player_id: playerId,
      name: playerName,
      role_id: null,
      role: null,
      joined_at: new Date().toISOString(),
      is_owner: false,
      is_ready: false,
    });

    if (room.players.length >= 2) {
      room.status = "ready";
    }

    return room;
  }

  selectRole(roomId: string, playerId: string, roleId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.find((p) => p.player_id === playerId);
    if (!player) return false;

    // Check role not already taken
    if (room.players.some((p) => p.role_id === roleId && p.player_id !== playerId)) {
      return false;
    }

    const bible = this.storyBibles.get(room.story_bible_id);
    const role = bible?.roles.find((r) => r.id === roleId);
    if (!role) return false;

    player.role_id = roleId;
    player.role = role;
    player.is_ready = true;

    if (room.players.length > 0 && room.players.every((p) => p.role_id)) {
      room.status = "ready";
    }

    return true;
  }

  startStory(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const bible = this.storyBibles.get(room.story_bible_id);
    if (!bible) return false;

    // MVP allows a solo demo room. Every real joined player must have selected a role.
    if (room.players.some((p) => !p.is_ai && !p.role_id)) return false;
    this.fillMissingRolesWithAIPlayers(room, bible);

    // Create world state
    const ws = createWorldState(bible.id, roomId, bible);
    for (const player of room.players) {
      if (!player.role) continue;
      ws.knowledge_state.player_knowledge[player.player_id] = {
        player_id: player.player_id,
        known_facts: [...player.role.initial_knowledge],
        known_npcs: [],
        known_locations: [player.role.starting_location],
        known_events: [],
        evidence: [],
        discovered_clues: [],
        private_chat_unlocked_with: [],
      };
      ws.character_states[player.player_id] = {
        character_id: player.player_id,
        status: "alive",
        ghost_mode: false,
      };
    }
    this.worldStates.set(room.world_state_id, ws);

    room.status = "running";
    return true;
  }

  updateRoomStatus(roomId: string, status: RoomStatus): void {
    const room = this.rooms.get(roomId);
    if (room) room.status = status;
  }

  getWorldState(roomId: string): WorldState | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return this.worldStates.get(room.world_state_id);
  }

  updateWorldState(roomId: string, state: WorldState): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.worldStates.set(room.world_state_id, state);
    }
  }

  setStoryBible(bible: StoryBible): void {
    this.storyBibles.set(bible.id, enrichStoryBibleForSimulation(bible));
  }

  getStoryBible(id: string): StoryBible | undefined {
    return this.storyBibles.get(id);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getPlayer(roomId: string, playerId: string): Player | undefined {
    return this.rooms.get(roomId)?.players.find((p) => p.player_id === playerId);
  }

  private fillMissingRolesWithAIPlayers(room: Room, bible: StoryBible): void {
    const takenRoleIds = new Set(room.players.map((player) => player.role_id).filter(Boolean));
    for (const role of bible.roles) {
      if (takenRoleIds.has(role.id)) continue;
      const aiPlayerId = `ai_${role.id}`;
      const existing = room.players.find((player) => player.player_id === aiPlayerId);
      if (existing) {
        existing.role_id = role.id;
        existing.role = role;
        existing.is_ai = true;
        existing.is_ready = true;
        continue;
      }
      room.players.push({
        player_id: aiPlayerId,
        name: `${role.name}（AI代演）`,
        role_id: role.id,
        role,
        joined_at: new Date().toISOString(),
        is_owner: false,
        is_ready: true,
        is_ai: true,
      });
      takenRoleIds.add(role.id);
    }
  }
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Singleton
export const roomManager = new RoomManager();
