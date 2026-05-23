import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { player_id, player_name } = body;

    const room = roomManager.addPlayer(roomId, player_id, player_name);
    if (!room) {
      return NextResponse.json(
        { success: false, error: "加入房间失败，房间可能已满或不存在" },
        { status: 400 }
      );
    }

    const bible = roomManager.getStoryBible(room.story_bible_id);
    const availableRoles = bible?.roles.map((role) => ({
      id: role.id,
      name: role.name,
      public_identity: role.public_identity,
    })) ?? [];

    return NextResponse.json({ success: true, room: { ...room, available_roles: availableRoles } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
