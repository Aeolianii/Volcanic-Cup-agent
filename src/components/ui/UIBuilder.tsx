"use client";

import { useState } from "react";
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
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
            channels={playerView?.chat_channels || []}
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
            knownFacts={playerView?.known_facts || []}
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
            factions={playerView?.visible_factions || []}
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

  const centerMain = [...center, ...bottom].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-110px)] min-h-[680px] overflow-hidden">
      {/* Top widgets */}
      {top.length > 0 && (
        <div className="space-y-2">
          {top.map((w) => (
            <div key={w.key}>{renderWidget(w)}</div>
          ))}
        </div>
      )}

      <div className="flex-1 grid gap-4 overflow-hidden" style={{
        gridTemplateColumns: `${left.length > 0 ? (leftCollapsed ? "48px" : "300px") : "0px"} minmax(520px, 1fr) ${right.length > 0 ? (rightCollapsed ? "48px" : "320px") : "0px"}`,
      }}>
        {/* Left column */}
        {left.length > 0 && (
          <div className="min-h-0 overflow-hidden rounded-xl border border-midnight-600/50 bg-midnight-900/20">
            <ColumnHeader title="角色与状态" collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} />
            {!leftCollapsed && (
              <div className="h-[calc(100%-44px)] overflow-y-auto p-3 space-y-3">
                {left.map((w) => (
                  <div key={w.key}>{renderWidget(w)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Center */}
        <div className="min-w-0 min-h-0 overflow-y-auto space-y-3 pr-1">
          {centerMain.map((w) => (
            <div key={w.key} className={w.key === "ChatPanel" || w.key === "FreeActionInput" ? "max-w-none" : ""}>
              {renderWidget(w)}
            </div>
          ))}
        </div>

        {/* Right column */}
        {right.length > 0 && (
          <div className="min-h-0 overflow-hidden rounded-xl border border-midnight-600/50 bg-midnight-900/20">
            <ColumnHeader title="行动与线索" collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} />
            {!rightCollapsed && (
              <div className="h-[calc(100%-44px)] overflow-y-auto p-3 space-y-3">
                {right.map((w) => (
                  <div key={w.key}>{renderWidget(w)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnHeader({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="h-11 w-full flex items-center justify-between px-3 text-xs text-amber-300 border-b border-midnight-600/50 bg-midnight-800/40 hover:bg-midnight-700/50 transition-colors"
    >
      <span style={collapsed ? { writingMode: "vertical-rl" } : undefined}>{collapsed ? title.slice(0, 2) : title}</span>
      <span>{collapsed ? ">" : "<"}</span>
    </button>
  );
}
