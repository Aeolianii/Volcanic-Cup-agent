import { NextRequest, NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { detectActionInChat } from "@/engine/actionParser";
import { buildChatChannelsForPlayer } from "@/engine/knowledgeBoundary";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { player_id, content, channel_id = "public" } = body;

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { success: false, error: "房间不存在" },
        { status: 404 }
      );
    }

    const player = roomManager.getPlayer(roomId, player_id);
    if (!player) {
      return NextResponse.json(
        { success: false, error: "玩家不存在" },
        { status: 404 }
      );
    }

    const worldState = roomManager.getWorldState(roomId);
    const bible = roomManager.getStoryBible(room.story_bible_id);
    const characterState = worldState?.character_states[player_id] ||
      (player.role_id ? worldState?.character_states[player.role_id] : undefined);

    if (characterState?.ghost_mode) {
      return NextResponse.json(
        { success: false, error: "幽灵模式只能旁观，不能发送消息。" },
        { status: 403 }
      );
    }

    if (worldState && bible) {
      const allowedChannels = buildChatChannelsForPlayer(player, room.players, worldState, bible);
      if (!allowedChannels.some((channel) => channel.id === channel_id)) {
        return NextResponse.json(
          { success: false, error: "该频道尚未解锁。" },
          { status: 403 }
        );
      }
    }

    const isActionHint = detectActionInChat(content);
    const messageId = `msg_${Date.now()}`;
    const channelType = String(channel_id).startsWith("faction:")
      ? "faction"
      : String(channel_id).startsWith("pm:")
      ? "private"
      : "public";

    return NextResponse.json({
      success: true,
      message: {
        id: messageId,
        room_id: roomId,
        sender_id: player_id,
        sender_type: "player",
        sender_name: player.name,
        content,
        timestamp: new Date().toISOString(),
        is_action_hint: isActionHint,
        channel_id,
        channel_type: channelType,
      },
      action_hint: isActionHint
        ? {
            message_id: messageId,
            detected_action: content,
            suggestion: "这看起来是一个行动，是否作为正式行动提交？",
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
