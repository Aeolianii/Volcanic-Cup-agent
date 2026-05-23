import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { parsePlayerAction, parseSuggestedAction } from "@/engine/actionParser";
import { processPlayerAction } from "@/engine/ruleEngine";
import { applyUpdates } from "@/engine/worldStateEngine";
import { checkEventTriggers } from "@/engine/eventTriggerSystem";
import { checkEndings } from "@/engine/endingJudge";
import { generateGMNarrative } from "@/engine/aiGM";
import { getAIProvider } from "@/lib/aiProvider";
import type { ActionType, ParsedAction, StructuredAction } from "@/types";

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
        const parsed = await getAIProvider().parseAction(rawInput, {
          player_id: body.player_id,
          player_role: room.players.find((p) => p.player_id === body.player_id)?.role?.name || "",
          current_location: body.current_location || "",
          known_facts: body.known_facts || [],
          active_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
        });
        structuredAction = toStructuredAction(parsed, rawInput, body.player_id);
      } catch {
        structuredAction = fallbackAction;
      }
    }

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
      ]);
    }
    roomManager.updateWorldState(roomId, worldState);

    // Check endings
    const endingResult = checkEndings(worldState, bible);

    // Generate GM narrative
    const gmPhase = triggeredEvents.length > 0 ? "event_narration" : "turn_narration";
    const gmNarrative = await generateGMNarrative(bible, worldState, getAIProvider(), gmPhase);

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
