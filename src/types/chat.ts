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
}

export interface ChatHint {
  message_id: string;
  detected_action: string;
  suggestion: string;
}
