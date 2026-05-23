import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";

export async function POST(
  _request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const success = roomManager.startStory(roomId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "开始故事失败，确保所有玩家已选择角色" },
        { status: 400 }
      );
    }

    const room = roomManager.getRoom(roomId);
    const worldState = roomManager.getWorldState(roomId);

    return NextResponse.json({ success: true, room, world_state: worldState });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
