"use client";

import { useEffect, useRef, useState } from "react";
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
  const visibleChannels =
    channels.length > 0
      ? channels
      : [{ id: "public", type: "public" as const, label: "公共频道", member_ids: [], pinned: true, unread_count: 0, unlocked: true }];
  const activeChannel = visibleChannels.find((channel) => channel.id === activeChannelId) || visibleChannels[0];
  const visibleMessages = messages.filter((message) => (message.channel_id || "public") === activeChannel.id);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChannel.id, visibleMessages.length]);

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
    <div className="panel flex min-h-[360px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="section-title text-base">通讯频道</h3>
          <p className="mt-1 text-xs text-parchment-500">公共讨论、阵营频道和私聊会集中显示在这里。</p>
        </div>
        {activeChannel.pinned && (
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
            置顶
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {visibleChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setActiveChannelId(channel.id)}
            className={`rounded border px-2.5 py-1 text-xs transition-all duration-200 hover:-translate-y-0.5 ${
              activeChannel.id === channel.id
                ? "border-amber-500 bg-amber-500/15 text-amber-100"
                : "border-midnight-500 bg-midnight-900/30 text-parchment-400 hover:border-amber-500/50 hover:text-parchment-100"
            }`}
          >
            {channel.label}
            {channel.unread_count > 0 && <span className="ml-1 text-amber-300">●</span>}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="mb-3 min-h-[190px] flex-1 space-y-3 overflow-y-auto rounded border border-midnight-500/60 bg-midnight-950/25 p-3"
      >
        {visibleMessages.length === 0 && (
          <p className="text-sm italic text-parchment-500">当前频道暂无消息。</p>
        )}
        {visibleMessages.map((message) => {
          const isOwn = message.sender_id === currentPlayerId;
          const isGM = message.sender_type === "gm";
          const senderLabel = isGM ? "游戏主持" : message.sender_name;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {!isOwn && (
                <span translate="no" className={`mb-1 text-xs ${isGM ? "text-amber-300" : "text-cyan-300"}`}>
                  {senderLabel}
                </span>
              )}
              <div
                className={`max-w-[86%] rounded px-3 py-2 text-sm leading-6 shadow-sm ${
                  isGM
                    ? "border border-amber-600/50 bg-amber-500/10 text-amber-100"
                    : message.highlighted
                      ? "border border-amber-500/60 bg-amber-500/10 text-amber-100"
                      : isOwn
                        ? "border border-cyan-600/50 bg-cyan-950/40 text-parchment-100"
                        : "border border-midnight-500 bg-midnight-700/60 text-parchment-200"
                }`}
              >
                {message.content}
              </div>
              {message.is_action_hint && onConvertToAction && (
                <button
                  type="button"
                  onClick={() => onConvertToAction(message.id)}
                  className="mt-1 text-xs text-amber-400 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
                >
                  {actionHint?.suggestion || "转为正式行动"}
                </button>
              )}
            </div>
          );
        })}

        {actionHint && (
          <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-200">
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
          className="input-field flex-1 text-sm"
        />
        <button onClick={handleSend} className="btn-primary px-4 text-sm">
          发送
        </button>
      </div>
    </div>
  );
}
