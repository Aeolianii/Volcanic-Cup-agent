import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const room = roomManager.getRoom(roomId);
    const worldState = roomManager.getWorldState(roomId);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "房间不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
