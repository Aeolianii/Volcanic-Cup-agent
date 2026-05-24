import type { AIProvider, Player, RuleResult, StoryBible, StructuredAction, WorldState } from "@/types";
import { applyUpdates } from "./worldStateEngine";
import { processPlayerAction } from "./ruleEngine";
import { canPlayerTakeAction, consumePlayerAction, ensureTurnState } from "./turnSystem";
import { inferScriptProfile } from "./metricGenerator";

export interface AIPlayerTurnResult {
  player_id: string;
  player_name: string;
  role_id: string;
  role_name: string;
  skipped: boolean;
  proposal?: StructuredAction;
  result?: RuleResult;
  public_result?: string;
}

export async function runDueAIPlayerTurns(
  state: WorldState,
  bible: StoryBible,
  players: Player[],
  aiProvider: AIProvider
): Promise<{ worldState: WorldState; aiPlayerResults: AIPlayerTurnResult[] }> {
  let worldState = ensureTurnState(state);
  const aiPlayers = players.filter((player) => player.is_ai && player.role_id && player.role);
  const results: AIPlayerTurnResult[] = [];

  for (const aiPlayer of aiPlayers) {
    const characterState = worldState.character_states[aiPlayer.player_id];
    const plannedFallback = fallbackAction(aiPlayer, players, bible, worldState);
    if (characterState?.ghost_mode || !canPlayerTakeAction(worldState, aiPlayer.player_id, plannedFallback).allowed) {
      results.push(aiResult(aiPlayer, true));
      continue;
    }

    while (canPlayerTakeAction(worldState, aiPlayer.player_id, plannedFallback).allowed) {
      const proposal = await proposeAIPlayerAction(aiPlayer, players, bible, worldState, aiProvider);
      if (!proposal) {
        worldState = consumePlayerAction(worldState, aiPlayer.player_id, fallbackAction(aiPlayer, players, bible, worldState));
        results.push(aiResult(aiPlayer, true));
        break;
      }

      const result = processPlayerAction(proposal, worldState, bible);
      worldState = applyUpdates(worldState, result.state_updates);
      worldState = consumePlayerAction(worldState, aiPlayer.player_id, proposal);
      results.push(aiResult(aiPlayer, false, proposal, result));
    }
  }

  return { worldState, aiPlayerResults: results };
}

async function proposeAIPlayerAction(
  aiPlayer: Player,
  players: Player[],
  bible: StoryBible,
  state: WorldState,
  _aiProvider: AIProvider
): Promise<StructuredAction | null> {
  const fallback = fallbackAction(aiPlayer, players, bible, state);
  return fallback;
}

function fallbackAction(aiPlayer: Player, players: Player[], bible: StoryBible, state: WorldState): StructuredAction {
  const profile = inferScriptProfile(bible);
  const targetRole = pickTargetRole(aiPlayer, players, bible);
  const activeEvent = state.events.find((event) => event.triggered);
  const nextEvent = bible.events.find((event) => event.id === activeEvent?.event_id) || bible.events[0];
  const isRelationship = profile === "romance" || profile === "relationship";
  const isMystery = profile === "mystery";

  return {
    actor_id: aiPlayer.player_id,
    actor_type: "player",
    action_source: "suggested_action",
    action_type: isRelationship ? "talk" : isMystery ? "investigate" : "gain_support",
    target: isRelationship ? targetRole?.id || "public_scene" : nextEvent?.id || targetRole?.id || "public_scene",
    method: isRelationship ? "private_or_public_conversation" : isMystery ? "verify_contradiction" : "public_positioning",
    intent: isRelationship ? "clarify_feelings_and_memory" : isMystery ? "advance_truth_path" : "improve_own_position",
    risk_level: "medium",
    raw_input: isRelationship
      ? `主动靠近${targetRole?.name || "关键角色"}，确认彼此真实态度`
      : isMystery
        ? "核验当前线索中的矛盾点"
        : "公开争取局势主动权",
    metadata: { ai_substitute: true, ai_role_id: aiPlayer.role_id },
  };
}

function pickTargetRole(aiPlayer: Player, players: Player[], bible: StoryBible) {
  const otherHuman = players.find((player) => !player.is_ai && player.role_id && player.role_id !== aiPlayer.role_id);
  if (otherHuman?.role) return otherHuman.role;
  return bible.roles.find((role) => role.id !== aiPlayer.role_id);
}

function aiResult(aiPlayer: Player, skipped: boolean, proposal?: StructuredAction, result?: RuleResult): AIPlayerTurnResult {
  return {
    player_id: aiPlayer.player_id,
    player_name: aiPlayer.name,
    role_id: aiPlayer.role_id || "",
    role_name: aiPlayer.role?.name || aiPlayer.name,
    skipped,
    proposal,
    result,
    public_result: result?.public_result,
  };
}
