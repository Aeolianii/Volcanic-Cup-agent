import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { runDueAIPlayerTurns } from "@/engine/aiPlayerTurnSystem";
import { getAIProvider } from "@/lib/aiProvider";

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const room = roomManager.getRoom(roomId);
    let worldState = roomManager.getWorldState(roomId);
    const bible = roomManager.getStoryBible(room?.story_bible_id || "");

    if (!room || !worldState || !bible) {
      return NextResponse.json(
        { success: false, error: "房间或故事不存在" },
        { status: 404 }
      );
    }

    const aiPlayerTurn = await runDueAIPlayerTurns(worldState, bible, room.players, getAIProvider());
    worldState = aiPlayerTurn.worldState;

    roomManager.updateWorldState(roomId, worldState);

    return NextResponse.json({
      success: true,
      npc_results: aiPlayerTurn.aiPlayerResults,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
