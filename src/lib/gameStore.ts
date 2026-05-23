"use client";

import { createContext, useContext } from "react";
import type { Room, WorldState, PlayerView, ChatMessage, StructuredAction, StoryBible } from "@/types";

export interface GameState {
  room: Room | null;
  worldState: WorldState | null;
  playerView: PlayerView | null;
  chatMessages: ChatMessage[];
  currentPlayerId: string | null;
  storyBible: StoryBible | null;
  phase: "lobby" | "playing" | "ending";
}

export type GameAction =
  | { type: "SET_ROOM"; room: Room }
  | { type: "SET_WORLD_STATE"; state: WorldState }
  | { type: "SET_PLAYER_VIEW"; view: PlayerView }
  | { type: "SET_STORY_BIBLE"; bible: StoryBible }
  | { type: "ADD_CHAT_MESSAGE"; message: ChatMessage }
  | { type: "SET_CURRENT_PLAYER"; playerId: string }
  | { type: "SET_PHASE"; phase: GameState["phase"] }
  | { type: "RESET" };

export const initialGameState: GameState = {
  room: null,
  worldState: null,
  playerView: null,
  chatMessages: [],
  currentPlayerId: null,
  storyBible: null,
  phase: "lobby",
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_ROOM":
      return { ...state, room: action.room };
    case "SET_WORLD_STATE":
      return { ...state, worldState: action.state };
    case "SET_PLAYER_VIEW":
      return { ...state, playerView: action.view };
    case "SET_STORY_BIBLE":
      return { ...state, storyBible: action.bible };
    case "ADD_CHAT_MESSAGE":
      return { ...state, chatMessages: [...state.chatMessages, action.message] };
    case "SET_CURRENT_PLAYER":
      return { ...state, currentPlayerId: action.playerId };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "RESET":
      return initialGameState;
    default:
      return state;
  }
}

export const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}>({
  state: initialGameState,
  dispatch: () => {},
});

export function useGameState() {
  return useContext(GameContext);
}
