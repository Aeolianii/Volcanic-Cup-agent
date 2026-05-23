"use client";

import type { ActiveEvent } from "@/types";

interface EventPanelProps {
  events: ActiveEvent[];
  allEvents?: { id: string; title: string; description: string; triggered: boolean }[];
}

export function EventPanel({ events, allEvents }: EventPanelProps) {
  const displayEvents = allEvents || events;

  if (displayEvents.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">事件</h3>
        <p className="text-parchment-500 text-sm">暂无事件</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-2">事件追踪</h3>
      <div className="space-y-2">
        {displayEvents.map((event) => {
          const isActive = "triggered" in event ? event.triggered : true;
          const eventKey = "id" in event ? event.id : event.event_id;
          return (
            <div
              key={eventKey}
              className={`p-2 rounded border text-sm ${
                isActive
                  ? "border-amber-600/50 bg-amber-900/10"
                  : "border-midnight-600 bg-midnight-700/30 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isActive ? "bg-amber-500" : "bg-midnight-500"}`} />
                <span className={`font-medium ${isActive ? "text-amber-300" : "text-parchment-500"}`}>
                  {event.title}
                </span>
                {isActive && (
                  <span className="text-[10px] text-amber-600 animate-pulse">进行中</span>
                )}
              </div>
              {"description" in event && event.description && (
                <p className="text-xs text-parchment-500 mt-1 ml-4">{event.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
