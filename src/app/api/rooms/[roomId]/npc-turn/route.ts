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

    const npcTurn = await runDueNPCTurns(worldState, bible, getAIProvider(), getAIControlledRoleIds(room, bible));
    worldState = npcTurn.worldState;

    roomManager.updateWorldState(roomId, worldState);

    return NextResponse.json({
      success: true,
      npc_results: npcTurn.npcResults.map((item) => ({
        npc_id: item.npc_id,
        npc_name: item.npc_name,
        actor_kind: item.actor_kind,
        role_id: item.role_id,
        skipped: item.skipped,
        success: item.result?.success,
        visibility: item.proposal?.visibility,
        action_type: item.proposal?.visibility === "public" ? item.proposal?.action_type : undefined,
        public_result: item.public_result,
      })),
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
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
