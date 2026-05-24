"use client";

import type { ActiveEvent } from "@/types";

interface EventPanelProps {
  events: ActiveEvent[];
}

export function EventPanel({ events }: EventPanelProps) {
  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-3">
        <span>⚡</span> 事件追踪
      </h3>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-parchment-500 gap-1">
          <span className="text-xl opacity-40">📋</span>
          <p className="text-sm">暂无已解锁事件</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.event_id}
              className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30 transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-glow" />
                <span className="font-medium text-amber-300 text-sm">{event.title}</span>
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  进行中
                </span>
              </div>
              {event.description && (
                <p className="text-xs text-parchment-400 ml-4.5 leading-relaxed">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
