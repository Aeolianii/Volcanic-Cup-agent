import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { player_id, role_id } = body;

    const success = roomManager.selectRole(roomId, player_id, role_id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "选择角色失败，角色可能已被选择" },
        { status: 400 }
      );
    }

    const room = roomManager.getRoom(roomId);
    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
