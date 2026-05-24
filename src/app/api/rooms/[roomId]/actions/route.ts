import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { parsePlayerAction, parseSuggestedAction } from "@/engine/actionParser";
import { processPlayerAction } from "@/engine/ruleEngine";
import { applyUpdates, decrementActiveModifiers } from "@/engine/worldStateEngine";
import { runDueNPCTurns } from "@/engine/npcTurnSystem";
import { checkEventTriggers } from "@/engine/eventTriggerSystem";
import { checkEndings } from "@/engine/endingJudge";
import { generateGMNarrative } from "@/engine/aiGM";
import { runGMBalancerAgent } from "@/engine/gmBalancerAgent";
import { checkChapterTransition } from "@/engine/storyController";
import { getAIProvider } from "@/lib/aiProvider";
import type { ActionType, EventEffect, HistoricalAction, HistoricalWorldEvent, ParsedAction, RuleResult, StateUpdate, StoryBible, StructuredAction, WorldState } from "@/types";

const VALID_ACTION_TYPES: ActionType[] = [
  "talk", "persuade", "threaten", "deceive", "ally", "betray", "confess",
  "investigate", "search", "track", "eavesdrop", "interrogate", "decode", "spy", "divination", "gather_intelligence",
  "command", "summon_meeting", "gain_support", "coup", "impeach", "appoint",
  "attack", "assassinate", "duel", "ambush", "defend", "execute", "sacrifice",
  "buy", "trade", "steal", "transport", "build",
];

function toStructuredAction(parsed: ParsedAction, rawInput: string, actorId: string): StructuredAction {
  const actionType = VALID_ACTION_TYPES.includes(parsed.action_type as ActionType)
    ? (parsed.action_type as ActionType)
    : "investigate";

  return {
    actor_id: actorId,
    actor_type: "player",
    action_source: "free_action",
    action_type: actionType,
    target: parsed.target || "unknown",
    method: parsed.method || "direct",
    intent: parsed.intent || actionType,
    risk_level: parsed.risk_level || "medium",
    raw_input: rawInput,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI action parser timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();

    const room = roomManager.getRoom(roomId);
    let worldState = roomManager.getWorldState(roomId);
    const bible = roomManager.getStoryBible(room?.story_bible_id || "");

    if (!room || !worldState || !bible) {
      return NextResponse.json(
        { success: false, error: "房间或故事不存在" },
        { status: 404 }
      );
    }
    const actorState = worldState.character_states[body.player_id];
    if (actorState?.ghost_mode) {
      return NextResponse.json(
        { success: false, error: "幽灵模式只能旁观，不能执行行动。" },
        { status: 403 }
      );
    }

    // Parse action based on source
    let structuredAction: StructuredAction;
    if (body.action_source === "suggested_action") {
      structuredAction = parseSuggestedAction(
        body.label || body.raw_input,
        body.player_id,
        body.suggestion || body
      );
    } else {
      const rawInput = body.raw_input || body.content || "";
      const fallbackAction = parsePlayerAction(rawInput, body.player_id, {
        currentLocation: body.current_location,
        knownFacts: body.known_facts,
      });

      try {
        const parsed = await withTimeout(
          getAIProvider().parseAction(rawInput, {
            player_id: body.player_id,
            player_role: room.players.find((p) => p.player_id === body.player_id)?.role?.name || "",
            current_location: body.current_location || "",
            known_facts: body.known_facts || [],
            active_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
            runtime_modules: bible.runtime_modules,
          }),
          1500
        );
        structuredAction = toStructuredAction(parsed, rawInput, body.player_id);
      } catch {
        structuredAction = fallbackAction;
      }
    }
    structuredAction = normalizeActionTarget(structuredAction, bible, worldState);

    // Process this as the next turn so action records, discoveries, NPC observations,
    // events, and GM narration all refer to the same turn number.
    const actionTurnState = {
      ...worldState,
      turn: worldState.turn + 1,
    };
    const result = processPlayerAction(structuredAction, actionTurnState, bible);

    // Apply state updates
    worldState = applyUpdates(actionTurnState, result.state_updates);
    worldState = appendHistoricalAction(
      worldState,
      buildHumanHistoricalAction(structuredAction, result, room, bible, actionTurnState)
    );
    worldState = decrementActiveModifiers(worldState);
    const npcTurn = await runDueNPCTurns(worldState, bible, getAIProvider(), getAIControlledRoleIds(room, bible));
    worldState = npcTurn.worldState;
    worldState = appendHistoricalActions(worldState, buildAIHistoricalActions(npcTurn.npcResults, bible, worldState));
    const balanceResult = runGMBalancerAgent(room.players, worldState, bible);
    if (balanceResult.updates.length > 0) {
      worldState = applyUpdates(worldState, balanceResult.updates);
      worldState.balance_state = {
        ...worldState.balance_state,
        player_advantage_scores: balanceResult.scores,
        last_balance_turn: worldState.turn,
      };
    } else {
      worldState.balance_state = {
        ...worldState.balance_state,
        player_advantage_scores: balanceResult.scores,
      };
    }
    roomManager.updateWorldState(roomId, worldState);

    // Check event triggers
    const triggeredEvents = checkEventTriggers(worldState, bible);
    for (const te of triggeredEvents) {
      worldState = applyUpdates(worldState, [
        { type: "trigger_event", target: te.event.id },
        ...eventEffectsToStateUpdates(te.event.effects, body.player_id),
      ]);
    }
    const eventHistoryTurn = worldState.turn;
    worldState = appendHistoricalWorldEvents(
      worldState,
      triggeredEvents.map((item) => ({
        id: `world_event_${eventHistoryTurn}_${item.event.id}`,
        turn: eventHistoryTurn,
        event_id: item.event.id,
        title: item.event.title,
        description: item.event.description,
        trigger_reason: item.trigger_reason,
      }))
    );

    const chapterTransition = checkChapterTransition(worldState, bible);
    if (chapterTransition.should_transition) {
      worldState = {
        ...worldState,
        chapter: chapterTransition.to_chapter,
        flags: {
          ...worldState.flags,
          [`chapter_${chapterTransition.to_chapter}_started`]: true,
        },
      };
    }
    roomManager.updateWorldState(roomId, worldState);

    // Check endings and generate GM narrative in parallel after the state is settled.
    const gmPhase = triggeredEvents.length > 0 ? "event_narration" : "turn_narration";
    const [endingResult, gmNarrative] = await Promise.all([
      Promise.resolve(checkEndings(worldState, bible)),
      generateGMNarrative(
        bible,
        worldState,
        getAIProvider(),
        gmPhase,
        {
          action: structuredAction,
          result,
          npc_results: npcTurn.npcResults
            .filter((item) => !item.skipped)
            .map((item) => ({
              npc_id: item.npc_id,
              action_type: item.proposal?.visibility === "public" ? item.proposal?.action_type : undefined,
              intention: item.proposal?.visibility === "public" ? item.proposal?.intention : undefined,
              success: item.result?.success,
              visibility: item.proposal?.visibility,
              public_result: item.public_result,
              state_updates: item.proposal?.visibility === "public"
                ? item.result?.state_updates.map((update) => ({
                    type: update.type,
                    target: update.target,
                    fact_id: update.fact_id,
                    metric: update.metric,
                    delta: update.delta,
                    value: update.value,
                  }))
                : undefined,
            })),
          triggered_events: triggeredEvents.map((item) => ({
            id: item.event.id,
            title: item.event.title,
            description: item.event.description,
          })),
        }
      ),
    ]);

    // Add GM message
    const gmMessage = {
      id: `msg_gm_${Date.now()}`,
      room_id: roomId,
      sender_id: "gm",
      sender_type: "gm" as const,
      sender_name: "GM",
      content: gmNarrative.narration,
      timestamp: new Date().toISOString(),
      channel_id: "public",
      channel_type: "public" as const,
      highlighted: true,
    };

    return NextResponse.json({
      success: true,
      action: structuredAction,
      rule_result: result,
      triggered_events: triggeredEvents.map((te) => ({
        event_id: te.event.id,
        title: te.event.title,
        reason: te.trigger_reason,
      })),
      ending: endingResult.reached ? endingResult.ending : null,
      all_endings_status: endingResult.all_endings_status,
      chapter_transition: chapterTransition.should_transition ? chapterTransition : null,
      gm_narrative: gmNarrative,
      gm_provider_status: gmNarrative.provider_status,
      gm_message: gmMessage,
      npc_results: npcTurn.npcResults.map(toPublicNPCResult),
      suggested_actions: gmNarrative.suggested_actions,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function toPublicNPCResult(item: {
  npc_id: string;
  npc_name: string;
  actor_kind?: string;
  role_id?: string;
  skipped: boolean;
  public_result?: string;
  result?: { success: boolean };
  proposal?: { visibility?: string; action_type?: string };
}) {
  return {
    npc_id: item.npc_id,
    npc_name: item.npc_name,
    actor_kind: item.actor_kind,
    role_id: item.role_id,
    skipped: item.skipped,
    success: item.result?.success,
    visibility: item.proposal?.visibility,
    action_type: item.proposal?.visibility === "public" ? item.proposal?.action_type : undefined,
    public_result: item.public_result,
  };
}

function appendHistoricalAction(state: WorldState, action: HistoricalAction): WorldState {
  return appendHistoricalActions(state, [action]);
}

function appendHistoricalActions(state: WorldState, actions: HistoricalAction[]): WorldState {
  if (actions.length === 0) return ensureHistory(state);
  const next = ensureHistory(state);
  const existing = new Set(next.history.actions.map((item) => item.id));
  return {
    ...next,
    history: {
      ...next.history,
      actions: [
        ...next.history.actions,
        ...actions.filter((item) => !existing.has(item.id)),
      ].sort((a, b) => a.turn - b.turn),
    },
  };
}

function appendHistoricalWorldEvents(state: WorldState, events: HistoricalWorldEvent[]): WorldState {
  if (events.length === 0) return ensureHistory(state);
  const next = ensureHistory(state);
  const existing = new Set(next.history.world_events.map((item) => item.id));
  return {
    ...next,
    history: {
      ...next.history,
      world_events: [
        ...next.history.world_events,
        ...events.filter((item) => !existing.has(item.id)),
      ].sort((a, b) => a.turn - b.turn),
    },
  };
}

function ensureHistory(state: WorldState): WorldState {
  return {
    ...state,
    history: {
      actions: state.history?.actions || [],
      world_events: state.history?.world_events || [],
    },
  };
}

function buildHumanHistoricalAction(
  action: StructuredAction,
  result: RuleResult,
  room: { players: Array<{ player_id: string; name: string; role_id: string | null; role?: { name: string } | null }> },
  bible: StoryBible,
  state: WorldState
): HistoricalAction {
  const player = room.players.find((item) => item.player_id === action.actor_id);
  const role = action.actor_id ? bible.roles.find((item) => item.id === player?.role_id || item.id === action.actor_id) : undefined;
  return {
    id: result.action_id,
    turn: state.turn,
    actor_id: action.actor_id,
    actor_type: "human_player",
    actor_name: player?.name || role?.name || action.actor_id,
    role_id: player?.role_id || role?.id || null,
    role_name: player?.role?.name || role?.name,
    action_type: action.action_type,
    target: action.target,
    target_name: formatEntityName(action.target, bible, state),
    method: action.method,
    intent: action.intent,
    risk_level: action.risk_level,
    success: result.success,
    public_result: result.public_result,
    raw_input: action.raw_input,
  };
}

function buildAIHistoricalActions(
  results: Array<{
    npc_id: string;
    npc_name: string;
    actor_kind?: string;
    role_id?: string;
    skipped: boolean;
    public_result?: string;
    result?: RuleResult;
    proposal?: { action_type?: string; target?: string; method?: string; intention?: string; risk_level?: "low" | "medium" | "high" };
  }>,
  bible: StoryBible,
  state: WorldState
): HistoricalAction[] {
  return results
    .filter((item) => !item.skipped && item.result && item.proposal)
    .map((item) => {
      const role = bible.roles.find((roleItem) => roleItem.id === (item.role_id || item.npc_id));
      return {
        id: item.result?.action_id || `ai_action_${state.turn}_${item.npc_id}`,
        turn: state.turn,
        actor_id: item.npc_id,
        actor_type: item.actor_kind === "ai_player_role" ? "ai_player_role" : "npc",
        actor_name: item.npc_name,
        role_id: item.role_id || role?.id || null,
        role_name: role?.name || item.npc_name,
        action_type: String(item.proposal?.action_type || "act"),
        target: String(item.proposal?.target || ""),
        target_name: formatEntityName(String(item.proposal?.target || ""), bible, state),
        method: String(item.proposal?.method || ""),
        intent: String(item.proposal?.intention || ""),
        risk_level: item.proposal?.risk_level || "medium",
        success: Boolean(item.result?.success),
        public_result: item.public_result || item.result?.public_result || "",
      };
    });
}

function formatEntityName(id: string | undefined, bible: StoryBible, state: WorldState): string {
  if (!id) return "";
  const role = bible.roles.find((item) => item.id === id || item.name === id);
  if (role) return role.name;
  const npc = bible.npcs.find((item) => item.id === id || item.name === id);
  if (npc) return npc.name;
  const event = bible.events.find((item) => item.id === id || item.title === id);
  if (event) return event.title;
  const location = state.locations.find((item) => item.id === id || item.name === id);
  if (location) return location.name;
  return id;
}

function getAIControlledRoleIds(
  room: { players: Array<{ role_id: string | null }> },
  bible: { roles: Array<{ id: string }> }
): string[] {
  const humanRoleIds = new Set(room.players.map((player) => player.role_id).filter(Boolean));
  return bible.roles
    .map((role) => role.id)
    .filter((roleId) => !humanRoleIds.has(roleId));
}

function eventEffectsToStateUpdates(effects: EventEffect[], playerId: string): StateUpdate[] {
  return effects.flatMap((effect): StateUpdate[] => {
    switch (effect.type) {
      case "set_flag":
        return [{ type: "set_flag", flag: effect.target, value: effect.value }];
      case "modify_metric":
        return [{
          type: "metric_change",
          metric: effect.target,
          delta: typeof effect.value === "number" ? effect.value : Number(effect.value) || 0,
        }];
      case "add_knowledge":
        return [
          { type: "add_known_fact", target: playerId, fact_id: String(effect.value || effect.target) },
          { type: "set_flag", flag: String(effect.value || effect.target), value: true },
        ];
      case "reveal_event":
        return [{ type: "set_flag", flag: String(effect.target), value: effect.value }];
      case "change_location":
        return [{ type: "change_location", target: playerId, value: String(effect.value || effect.target) }];
      default:
        return [];
    }
  });
}

function normalizeActionTarget(
  action: StructuredAction,
  bible: { npcs: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }>; events: Array<{ id: string; title: string }> },
  worldState: { locations: Array<{ id: string; name: string; connected_locations: string[]; present_characters: string[] }> }
): StructuredAction {
  const target = String(action.target || "");
  const aliases: Record<string, string> = {
    archmage: "npc_archmage",
    old_king: "npc_old_king",
    bishop: "npc_bishop",
    prince: "role_prince",
    saintess: "role_saintess",
    assassin: "role_assassin",
    knight: "role_knight",
  };

  if (aliases[target]) return { ...action, target: aliases[target] };

  const currentLocation = worldState.locations.find((location) =>
    location.present_characters.includes(action.actor_id)
  );

  if (target === "current_location") {
    return { ...action, target: currentLocation?.id || target };
  }

  if (target === "connected_location") {
    const nextLocationId = currentLocation?.connected_locations?.[0];
    return { ...action, target: nextLocationId || currentLocation?.id || target };
  }

  const npc = bible.npcs.find((item) => item.name === target || item.id === target);
  if (npc) return { ...action, target: npc.id };

  const role = bible.roles.find((item) => item.name === target || item.id === target);
  if (role) return { ...action, target: role.id };

  const event = bible.events.find((item) => item.title === target || item.id === target);
  if (event) return { ...action, target: event.id };

  return action;
}
