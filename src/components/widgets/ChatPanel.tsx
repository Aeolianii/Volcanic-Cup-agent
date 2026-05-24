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
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2">
          <span>💬</span> 通讯频道
        </h3>
        {activeChannel.pinned && (
          <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-600/30 rounded-full px-2 py-0.5">
            📌 置顶
          </span>
        )}
      </div>

      {/* Channel Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {visibleChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setActiveChannelId(channel.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
              activeChannel.id === channel.id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-200 shadow-glow-amber-sm"
                : "border-midnight-600/50 bg-midnight-700/30 text-parchment-400 hover:border-amber-600/40 hover:text-parchment-300"
            }`}
          >
            {channel.unread_count > 0 && (
              <span className="mr-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
            )}
            {channel.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[150px] pr-1">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-parchment-500 gap-2">
            <span className="text-2xl opacity-50">💭</span>
            <p className="text-sm italic">当前频道暂无消息</p>
          </div>
        )}
        {visibleMessages.map((message) => {
          const isOwn = message.sender_id === currentPlayerId;
          const isGM = message.sender_type === "gm";
          const senderLabel = isGM ? "游戏主持" : message.sender_name;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"} animate-fade-in-up`}>
              {!isOwn && (
                <span
                  translate="no"
                  className={`text-[11px] mb-1 px-1 ${
                    isGM ? "text-amber-400 font-medium" : "text-blue-400"
                  }`}
                >
                  {isGM ? "🎭 " : ""}{senderLabel}
                </span>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  isGM
                    ? "bg-amber-500/8 border border-amber-600/30 text-amber-100 italic rounded-tl-md"
                    : message.highlighted
                    ? "bg-amber-500/10 border border-amber-500/40 text-amber-100 rounded-tl-md"
                    : isOwn
                    ? "bg-blue-500/10 border border-blue-500/30 text-parchment-100 rounded-tr-md"
                    : "bg-midnight-700/60 border border-midnight-500/40 text-parchment-200 rounded-tl-md"
                }`}
              >
                {message.content}
              </div>
              {message.is_action_hint && onConvertToAction && (
                <button
                  onClick={() => onConvertToAction(message.id)}
                  className="text-xs text-amber-400 hover:text-amber-300 mt-1 underline underline-offset-2 transition-colors"
                >
                  {actionHint?.suggestion || "转为正式行动"}
                </button>
              )}
            </div>
          );
        })}

        {actionHint && (
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 animate-fade-in">
            💡 {actionHint.suggestion}
          </div>
        )}
      </div>

      {/* Input */}
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
