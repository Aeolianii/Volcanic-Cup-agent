"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatChannel, ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  channels?: ChatChannel[];
  onSendMessage: (content: string, channelId: string) => void;
  currentPlayerId?: string | null;
  actionHint?: { messageId: string; suggestion: string } | null;
  onConvertToAction?: (messageId: string) => void;
}

export function ChatPanel({
  messages,
  channels = [],
  onSendMessage,
  currentPlayerId,
  actionHint,
  onConvertToAction,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [activeChannelId, setActiveChannelId] = useState("public");
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleChannels = channels.length > 0
    ? channels
    : [{ id: "public", type: "public" as const, label: "公共频道", member_ids: [], pinned: true, unread_count: 0, unlocked: true }];
  const activeChannel = visibleChannels.find((channel) => channel.id === activeChannelId) || visibleChannels[0];
  const visibleMessages = messages.filter((message) => (message.channel_id || "public") === activeChannel.id);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, activeChannel.id]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim(), activeChannel.id);
    setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel flex flex-col h-full max-h-[420px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-fantasy text-amber-400 text-sm">通讯频道</h3>
        {activeChannel.pinned && (
          <span className="badge-amber text-[10px]">置顶</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {visibleChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setActiveChannelId(channel.id)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
              activeChannel.id === channel.id
                ? "border-amber-600/50 bg-amber-900/20 text-amber-200"
                : "border-midnight-600/50 bg-midnight-800/30 text-parchment-500 hover:border-midnight-500 hover:text-parchment-300"
            }`}
          >
            {channel.label}
            {channel.unread_count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                {channel.unread_count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[150px] pr-1">
        {visibleMessages.length === 0 && (
          <p className="text-parchment-600 text-sm italic text-center py-4">当前频道暂无消息。</p>
        )}
        {visibleMessages.map((message) => {
          const isOwn = message.sender_id === currentPlayerId;
          const isGM = message.sender_type === "gm";
          const senderLabel = isGM ? "GM" : message.sender_name;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"} animate-in`}>
              {!isOwn && (
                <span className={`text-[11px] mb-0.5 px-1 ${isGM ? "text-amber-400" : "text-blue-400"}`}>
                  {senderLabel}
                </span>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  isGM
                    ? "bg-amber-900/20 border border-amber-700/30 text-amber-100"
                    : message.highlighted
                    ? "bg-amber-900/15 border border-amber-600/30 text-amber-100"
                    : isOwn
                    ? "bg-blue-900/20 border border-blue-700/30 text-parchment-100"
                    : "bg-midnight-800/50 border border-midnight-600/30 text-parchment-200"
                }`}
              >
                {message.content}
              </div>
              {message.is_action_hint && onConvertToAction && (
                <button
                  onClick={() => onConvertToAction(message.id)}
                  className="text-xs text-amber-500 hover:text-amber-300 mt-1 underline underline-offset-2 transition-colors"
                >
                  {actionHint?.suggestion || "转为正式行动"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入 RP 对话..."
          className="input-field text-sm flex-1"
        />
        <button onClick={handleSend} className="btn-primary text-sm px-4">
          发送
        </button>
      </div>
    </div>
  );
}
