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
        <p className="text-parchment-500 text-sm">暂无已解锁事件</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-2">事件追踪</h3>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.event_id}
            className="p-2 rounded border text-sm border-amber-600/50 bg-amber-900/10"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium text-amber-300">{event.title}</span>
              <span className="text-[10px] text-amber-600 animate-pulse">进行中</span>
            </div>
            {event.description && (
              <p className="text-xs text-parchment-500 mt-1 ml-4">{event.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
