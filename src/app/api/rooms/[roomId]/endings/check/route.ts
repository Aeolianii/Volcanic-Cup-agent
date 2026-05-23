import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { checkEndings } from "@/engine/endingJudge";
import { getAIProvider } from "@/lib/aiProvider";

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const room = roomManager.getRoom(roomId);
    const worldState = roomManager.getWorldState(roomId);
    const bible = roomManager.getStoryBible(room?.story_bible_id || "");

    if (!room || !worldState || !bible) {
      return NextResponse.json(
        { success: false, error: "房间或故事不存在" },
        { status: 404 }
      );
    }

    const endingResult = checkEndings(worldState, bible);

    let endingNarrative = "";
    if (endingResult.reached && endingResult.ending) {
      endingNarrative = await getAIProvider().generateEndingNarrative({
        ending_title: endingResult.ending.title,
        ending_description: endingResult.ending.description,
        world_state_summary: {
          flags: worldState.flags,
          metrics: worldState.metrics.map((m) => ({
            id: m.metric_id,
            label: m.metric_id,
            value: m.value,
          })),
          active_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
          player_locations: {},
        },
        key_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
        player_contributions: {},
      });

      roomManager.updateRoomStatus(roomId, "finished");
    }

    return NextResponse.json({
      success: true,
      ending: endingResult.reached ? endingResult.ending : null,
      all_endings_status: endingResult.all_endings_status,
      ending_narrative: endingNarrative,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
