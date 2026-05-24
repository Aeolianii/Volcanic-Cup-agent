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
    <div className="panel flex flex-col h-full max-h-[400px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-fantasy text-amber-400 text-sm">通讯频道</h3>
        {activeChannel.pinned && (
          <span className="text-[10px] text-amber-300 border border-amber-600/40 rounded px-1.5 py-0.5">置顶</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {visibleChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setActiveChannelId(channel.id)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              activeChannel.id === channel.id
                ? "border-amber-500 bg-amber-900/30 text-amber-200"
                : "border-midnight-600 bg-midnight-700/40 text-parchment-400 hover:border-amber-600/50"
            }`}
          >
            {channel.label}
            {channel.unread_count > 0 && (
              <span className="ml-1 text-amber-300">●</span>
            )}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[150px]">
        {visibleMessages.length === 0 && (
          <p className="text-parchment-500 text-sm italic">当前频道暂无消息。</p>
        )}
        {visibleMessages.map((message) => {
          const isOwn = message.sender_id === currentPlayerId;
          const isGM = message.sender_type === "gm";
          const senderLabel = isGM ? "游戏主持" : message.sender_name;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {!isOwn && (
                <span
                  translate="no"
                  className={`text-xs mb-0.5 ${isGM ? "text-amber-400" : "text-blue-400"}`}
                >
                  {senderLabel}
                </span>
              )}
              <div
                className={`max-w-[80%] px-3 py-1.5 rounded text-sm ${
                  isGM
                    ? "bg-amber-900/40 border border-amber-700/50 text-amber-200 italic"
                    : message.highlighted
                    ? "bg-amber-900/30 border border-amber-500/60 text-amber-100"
                    : isOwn
                    ? "bg-blue-900/30 border border-blue-700/50 text-parchment-100"
                    : "bg-midnight-700/50 border border-midnight-500 text-parchment-200"
                }`}
              >
                {message.content}
              </div>
              {message.is_action_hint && onConvertToAction && (
                <button
                  onClick={() => onConvertToAction(message.id)}
                  className="text-xs text-amber-500 hover:text-amber-300 mt-1 underline"
                >
                  {actionHint?.suggestion || "转为正式行动"}
                </button>
              )}
            </div>
          );
        })}

        {actionHint && (
          <div className="bg-amber-900/20 border border-amber-600/50 rounded p-2 text-xs text-amber-400">
            {actionHint.suggestion}
          </div>
        )}
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
        <button onClick={handleSend} className="btn-primary text-sm px-3">
          发送
        </button>
      </div>
    </div>
  );
}
