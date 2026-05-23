import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { parsePlayerAction, parseSuggestedAction } from "@/engine/actionParser";
import { processPlayerAction } from "@/engine/ruleEngine";
import { applyUpdates } from "@/engine/worldStateEngine";
import { checkEventTriggers } from "@/engine/eventTriggerSystem";
import { checkEndings } from "@/engine/endingJudge";
import { generateGMNarrative } from "@/engine/aiGM";
import { checkChapterTransition } from "@/engine/storyController";
import { getAIProvider } from "@/lib/aiProvider";
import type { ActionType, EventEffect, ParsedAction, StateUpdate, StructuredAction } from "@/types";

const VALID_ACTION_TYPES: ActionType[] = [
  "talk", "persuade", "threaten", "deceive", "ally", "betray", "confess",
  "investigate", "search", "track", "eavesdrop", "interrogate", "decode",
  "command", "summon_meeting", "gain_support", "coup", "impeach", "appoint",
  "attack", "assassinate", "duel", "ambush", "defend",
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
          }),
          1500
        );
        structuredAction = toStructuredAction(parsed, rawInput, body.player_id);
      } catch {
        structuredAction = fallbackAction;
      }
    }
    structuredAction = normalizeActionTarget(structuredAction, bible, worldState);

    // Process through Rule Engine
    const result = processPlayerAction(structuredAction, worldState, bible);

    // Apply state updates
    worldState = applyUpdates(worldState, result.state_updates);
    worldState.turn += 1;
    roomManager.updateWorldState(roomId, worldState);

    // Check event triggers
    const triggeredEvents = checkEventTriggers(worldState, bible);
    for (const te of triggeredEvents) {
      worldState = applyUpdates(worldState, [
        { type: "trigger_event", target: te.event.id },
        ...eventEffectsToStateUpdates(te.event.effects, body.player_id),
      ]);
    }

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
      gm_message: gmMessage,
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
        return [{ type: "add_known_fact", target: playerId, fact_id: String(effect.value || effect.target) }];
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

  if (target === "connected_location") {
    const currentLocation = worldState.locations.find((location) =>
      location.present_characters.includes(action.actor_id)
    );
    const nextLocationId = currentLocation?.connected_locations?.[0];
    return { ...action, target: nextLocationId || "current_location" };
  }

  const npc = bible.npcs.find((item) => item.name === target || item.id === target);
  if (npc) return { ...action, target: npc.id };

  const role = bible.roles.find((item) => item.name === target || item.id === target);
  if (role) return { ...action, target: role.id };

  const event = bible.events.find((item) => item.title === target || item.id === target);
  if (event) return { ...action, target: event.id };

  return action;
}
