import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { DEMO_STORY_BIBLE } from "@/mock/demoStoryBible";

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

    if (!roomManager.getStoryBible(room.story_bible_id) && room.story_bible_id === DEMO_STORY_BIBLE.id) {
      roomManager.setStoryBible(DEMO_STORY_BIBLE);
    }

    const storyBible = roomManager.getStoryBible(room.story_bible_id);
    const availableRoles = storyBible?.roles.map((role) => ({
      id: role.id,
      name: role.name,
      public_identity: role.public_identity,
    })) ?? [];

    return NextResponse.json({
      success: true,
      room: { ...room, available_roles: availableRoles },
      story_bible: storyBible,
      world_state: worldState,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
