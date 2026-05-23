"use client";

import { type WidgetKey } from "@/registry/widgetRegistry";
import { NarrativePanel } from "@/components/widgets/NarrativePanel";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { RolePanel } from "@/components/widgets/RolePanel";
import { MetricPanel } from "@/components/widgets/MetricPanel";
import { EventPanel } from "@/components/widgets/EventPanel";
import { FactionPanel } from "@/components/widgets/FactionPanel";
import { EvidencePanel } from "@/components/widgets/EvidencePanel";
import { SuggestedActionsPanel } from "@/components/widgets/SuggestedActionsPanel";
import { FreeActionInput } from "@/components/widgets/FreeActionInput";
import { PlayerInfoPanel } from "@/components/widgets/PlayerInfoPanel";
import type { WidgetConfig } from "@/types";
import type { GameState } from "@/lib/gameStore";

interface UIBuilderProps {
  widgets: WidgetConfig[];
  gameState: GameState;
  onSendMessage: (content: string) => void;
  onSendAction: (action: string) => void;
  onSelectSuggestedAction: (action: { id: string; label: string; action_type: string; target: string; method: string; intent: string; risk_level: "low" | "medium" | "high"; context: string }) => void;
  onConvertToAction?: (messageId: string) => void;
  disabled?: boolean;
  pendingActionId?: string | null;
}

export function UIBuilder({
  widgets,
  gameState,
  onSendMessage,
  onSendAction,
  onSelectSuggestedAction,
  onConvertToAction,
  disabled = false,
  pendingActionId = null,
}: UIBuilderProps) {
  // Sort widgets by position and order
  const visibleWidgets = widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  // Group by position
  const top = visibleWidgets.filter((w) => w.position === "top");
  const left = visibleWidgets.filter((w) => w.position === "left");
  const center = visibleWidgets.filter((w) => w.position === "center");
  const right = visibleWidgets.filter((w) => w.position === "right");
  const bottom = visibleWidgets.filter((w) => w.position === "bottom");

  const renderWidget = (widget: WidgetConfig) => {
    const key = widget.key as WidgetKey;

    try {
      return renderWidgetByKey(key, widget.props);
    } catch {
      // Safe degradation: show placeholder for unknown widgets
      return (
        <div className="panel border-red-500/50">
          <p className="text-red-400 text-sm">组件 "{widget.key}" 不可用</p>
        </div>
      );
    }
  };

  // This function is intentionally verbose to explicitly map each widget
  // rather than using a dynamic lookup, ensuring type safety and clarity.
  function renderWidgetByKey(key: WidgetKey, _props?: Record<string, unknown>) {
    const { worldState, playerView, chatMessages, currentPlayerId, storyBible } = gameState;

    switch (key) {
      case "NarrativePanel":
        return (
          <NarrativePanel
            content={
              chatMessages
                .filter((m) => m.sender_type === "gm")
                .slice(-1)[0]?.content || ""
            }
            turn={worldState?.turn}
            chapter={worldState?.chapter}
          />
        );

      case "ChatPanel":
        return (
          <ChatPanel
            messages={chatMessages}
            onSendMessage={onSendMessage}
            currentPlayerId={currentPlayerId}
            onConvertToAction={onConvertToAction}
          />
        );

      case "SuggestedActionsPanel":
        return (
          <SuggestedActionsPanel
            actions={playerView?.suggested_actions || []}
            onSelectAction={(action) => {
              onSelectSuggestedAction({
                id: action.id,
                label: action.label,
                action_type: action.action_type,
                target: action.target,
                method: action.method,
                intent: action.intent,
                risk_level: action.risk_level,
                context: action.context,
              });
            }}
            disabled={disabled}
            pendingActionId={pendingActionId}
          />
        );

      case "FreeActionInput":
        return (
          <FreeActionInput
            onSubmitAction={onSendAction}
            disabled={disabled}
          />
        );

      case "RolePanel":
        return (
          <RolePanel
            role={
              gameState.room?.players.find((p) => p.player_id === gameState.currentPlayerId)
                ?.role || null
            }
          />
        );

      case "MetricPanel":
        return (
          <MetricPanel
            metrics={playerView?.visible_metrics || []}
          />
        );

      case "EventPanel":
        return (
          <EventPanel
            events={playerView?.active_events || []}
            allEvents={worldState?.events.map((e) => {
              const bibleEvent = storyBible?.events.find((be) => be.id === e.event_id);
              return {
                id: e.event_id,
                title: bibleEvent?.title || e.event_id,
                description: bibleEvent?.description || "",
                triggered: e.triggered,
              };
            })}
          />
        );

      case "EvidencePanel":
        return (
          <EvidencePanel
            evidence={playerView?.evidence || []}
            knownFacts={playerView?.known_facts || []}
          />
        );

      case "FactionPanel":
        return (
          <FactionPanel
            factions={storyBible?.factions || []}
            memberLabels={Object.fromEntries([
              ...(storyBible?.roles.map((role) => [role.id, role.name] as const) || []),
              ...(storyBible?.npcs.map((npc) => [npc.id, npc.name] as const) || []),
            ])}
          />
        );

      case "PlayerInfoPanel":
        return (
          <PlayerInfoPanel
            playerView={playerView}
          />
        );

      default:
        // Safe degradation
        return (
          <div className="panel border-red-500/50">
            <p className="text-red-400 text-sm">未知组件: {key}</p>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col gap-4 min-h-[600px]">
      {/* Top widgets */}
      {top.length > 0 && (
        <div className="space-y-2">
          {top.map((w) => (
            <div key={w.key}>{renderWidget(w)}</div>
          ))}
        </div>
      )}

      {/* Main area: left | center | right */}
      <div className="flex-1 grid grid-cols-12 gap-4">
        {/* Left column */}
        {left.length > 0 && (
          <div className="col-span-3 space-y-3">
            {left.map((w) => (
              <div key={w.key}>{renderWidget(w)}</div>
            ))}
          </div>
        )}

        {/* Center */}
        <div className={`space-y-3 ${left.length > 0 && right.length > 0 ? "col-span-6" : left.length > 0 || right.length > 0 ? "col-span-9" : "col-span-12"}`}>
          {center.map((w) => (
            <div key={w.key}>{renderWidget(w)}</div>
          ))}
        </div>

        {/* Right column */}
        {right.length > 0 && (
          <div className="col-span-3 space-y-3">
            {right.map((w) => (
              <div key={w.key}>{renderWidget(w)}</div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom widgets */}
      {bottom.length > 0 && (
        <div className="space-y-2">
          {bottom.map((w) => (
            <div key={w.key}>{renderWidget(w)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
