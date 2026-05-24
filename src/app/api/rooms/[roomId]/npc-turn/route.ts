import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { runDueNPCTurns } from "@/engine/npcTurnSystem";
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

    const npcTurn = await runDueNPCTurns(worldState, bible, getAIProvider());
    worldState = npcTurn.worldState;

    roomManager.updateWorldState(roomId, worldState);

    return NextResponse.json({
      success: true,
      npc_results: npcTurn.npcResults,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
