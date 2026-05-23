import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { buildNPCLocalView } from "@/engine/npcKnowledgeFilter";
import { generateNPCActionProposal } from "@/engine/npcPlanner";
import { processNPCAction } from "@/engine/ruleEngine";
import { applyUpdates } from "@/engine/worldStateEngine";
import { mockAIProvider } from "@/mock/mockAIProvider";

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

    const npcResults = [];

    for (const npc of bible.npcs) {
      const localView = buildNPCLocalView(npc, worldState, bible);
      const proposal = await generateNPCActionProposal(npc, localView, mockAIProvider);

      const result = processNPCAction(proposal, worldState, bible);
      worldState = applyUpdates(worldState, result.state_updates);

      npcResults.push({
        npc_id: npc.id,
        npc_name: npc.name,
        proposal,
        result,
        public_result: result.public_result,
      });
    }

    roomManager.updateWorldState(roomId, worldState);

    return NextResponse.json({
      success: true,
      npc_results: npcResults,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
