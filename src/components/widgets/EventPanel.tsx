"use client";

import type { ActiveEvent } from "@/types";

interface EventPanelProps {
  events: ActiveEvent[];
}

export function EventPanel({ events }: EventPanelProps) {
  if (events.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">事件追踪</h3>
        <p className="text-parchment-600 text-sm">暂无已解锁事件</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">事件追踪</h3>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.event_id}
            className="glass p-3 border-amber-600/20"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium text-amber-300 text-sm">{event.title}</span>
              <span className="badge-amber text-[10px]">进行中</span>
            </div>
            {event.description && (
              <p className="text-xs text-parchment-600 mt-2 ml-4 leading-relaxed">{event.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
