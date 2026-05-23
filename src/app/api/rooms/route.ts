import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { story_bible_id, player_id, player_name } = body;

    if (!story_bible_id || !player_id || !player_name) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const room = roomManager.createRoom(story_bible_id, player_id, player_name);

    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const rooms = roomManager.getAllRooms();
    return NextResponse.json({ success: true, rooms });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
