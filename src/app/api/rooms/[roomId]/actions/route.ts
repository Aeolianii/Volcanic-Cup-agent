import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { parsePlayerAction, parseSuggestedAction } from "@/engine/actionParser";
import { processPlayerAction } from "@/engine/ruleEngine";
import { applyUpdates } from "@/engine/worldStateEngine";
import { checkEventTriggers } from "@/engine/eventTriggerSystem";
import { checkEndings } from "@/engine/endingJudge";
import { generateGMNarrative } from "@/engine/aiGM";
import { mockAIProvider } from "@/mock/mockAIProvider";

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
    let structuredAction;
    if (body.action_source === "suggested_action") {
      structuredAction = parseSuggestedAction(
        body.label || body.raw_input,
        body.player_id,
        body.suggestion || body
      );
    } else {
      structuredAction = parsePlayerAction(body.raw_input || body.content, body.player_id, {
        currentLocation: body.current_location,
        knownFacts: body.known_facts,
      });
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
    const gmNarrative = await generateGMNarrative(bible, worldState, mockAIProvider, gmPhase);

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
