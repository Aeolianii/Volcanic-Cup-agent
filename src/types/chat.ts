// ============================================================
// Chat Types
// ============================================================

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: "player" | "npc" | "gm";
  sender_name: string;
  content: string;
  timestamp: string;
  is_action_hint?: boolean;
  channel_id: string;
  channel_type: ChatChannelType;
  recipient_ids?: string[];
  highlighted?: boolean;
}

export type ChatChannelType = "public" | "faction" | "private" | "system";

export interface ChatChannel {
  id: string;
  type: ChatChannelType;
  label: string;
  member_ids: string[];
  pinned: boolean;
  unread_count: number;
  unlocked: boolean;
}

export interface ChatHint {
  message_id: string;
  detected_action: string;
  suggestion: string;
}
