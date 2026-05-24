"use client";

import { useState, type ReactNode } from "react";
import { type WidgetKey } from "@/registry/widgetRegistry";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { EvidencePanel } from "@/components/widgets/EvidencePanel";
import { EventPanel } from "@/components/widgets/EventPanel";
import { FactionPanel } from "@/components/widgets/FactionPanel";
import { FreeActionInput } from "@/components/widgets/FreeActionInput";
import { MetricPanel } from "@/components/widgets/MetricPanel";
import { NarrativePanel } from "@/components/widgets/NarrativePanel";
import { PlayerInfoPanel } from "@/components/widgets/PlayerInfoPanel";
import { RolePanel } from "@/components/widgets/RolePanel";
import { SuggestedActionsPanel } from "@/components/widgets/SuggestedActionsPanel";
import type { WidgetConfig } from "@/types";
import type { GameState } from "@/lib/gameStore";

interface UIBuilderProps {
  widgets: WidgetConfig[];
  gameState: GameState;
  onSendMessage: (content: string, channelId?: string) => void;
  onSendAction: (action: string) => void;
  onSelectSuggestedAction: (action: {
    id: string;
    label: string;
    action_type: string;
    target: string;
    method: string;
    intent: string;
    risk_level: "low" | "medium" | "high";
    context: string;
  }) => void;
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
  const visibleWidgets = widgets
    .filter((widget) => widget.visible)
    .sort((a, b) => a.order - b.order);

  const top = visibleWidgets.filter((widget) => widget.position === "top");
  const left = visibleWidgets.filter((widget) => widget.position === "left");
  const center = visibleWidgets.filter((widget) => widget.position === "center");
  const right = visibleWidgets.filter((widget) => widget.position === "right");
  const bottom = visibleWidgets.filter((widget) => widget.position === "bottom");
  const chatWidgets = visibleWidgets.filter((widget) => widget.key === "ChatPanel");
  const centerWidgets = [
    ...center.filter((widget) => widget.key !== "ChatPanel"),
    ...chatWidgets.filter((widget) => widget.position !== "center"),
  ];
  const bottomWidgets = bottom.filter((widget) => widget.key !== "ChatPanel");

  const renderWidget = (widget: WidgetConfig) => {
    const key = widget.key as WidgetKey;

    try {
      return renderWidgetByKey(key);
    } catch {
      return (
        <div className="panel border-red-500/50">
          <p className="text-sm text-red-400">组件 "{widget.key}" 不可用</p>
        </div>
      );
    }
  };

  function renderWidgetByKey(key: WidgetKey) {
    const { worldState, playerView, chatMessages, currentPlayerId, storyBible } = gameState;

    switch (key) {
      case "NarrativePanel":
        return (
          <NarrativePanel
            content={chatMessages.filter((message) => message.sender_type === "gm").slice(-1)[0]?.content || ""}
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
        return <FreeActionInput onSubmitAction={onSendAction} disabled={disabled} />;

      case "RolePanel":
        return (
          <RolePanel
            role={gameState.room?.players.find((player) => player.player_id === gameState.currentPlayerId)?.role || null}
          />
        );

      case "MetricPanel":
        return <MetricPanel metrics={playerView?.visible_metrics || []} />;

      case "EventPanel":
        return <EventPanel events={playerView?.active_events || []} />;

      case "EvidencePanel":
        return <EvidencePanel evidence={playerView?.evidence || []} knownFacts={playerView?.known_facts || []} />;

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
        return <PlayerInfoPanel playerView={playerView} />;

      default:
        return (
          <div className="panel border-red-500/50">
            <p className="text-sm text-red-400">未知组件：{key}</p>
          </div>
        );
    }
  }

  return (
    <div className="flex min-h-[600px] flex-col gap-4">
      {top.length > 0 && (
        <div className="space-y-2">
          {top.map((widget) => (
            <div key={`${widget.key}_${widget.order}`}>{renderWidget(widget)}</div>
          ))}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {left.length > 0 && (
          <aside className="space-y-3">
            {left.map((widget) => (
              <CollapsibleWidget key={`${widget.key}_${widget.order}`} widgetKey={widget.key}>
                {renderWidget(widget)}
              </CollapsibleWidget>
            ))}
          </aside>
        )}

        <main className="min-w-0 space-y-3">
          {centerWidgets.map((widget) => (
            <div key={`${widget.key}_${widget.order}`}>{renderWidget(widget)}</div>
          ))}
        </main>

        {right.length > 0 && (
          <aside className="space-y-3">
            {right.map((widget) => (
              <CollapsibleWidget key={`${widget.key}_${widget.order}`} widgetKey={widget.key}>
                {renderWidget(widget)}
              </CollapsibleWidget>
            ))}
          </aside>
        )}
      </div>

      {bottomWidgets.length > 0 && (
        <div className="space-y-2">
          {bottomWidgets.map((widget) => (
            <div key={`${widget.key}_${widget.order}`}>{renderWidget(widget)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleWidget({
  widgetKey,
  children,
}: {
  widgetKey: string;
  children: ReactNode;
}) {
  const defaultOpen = widgetKey === "SuggestedActionsPanel" || widgetKey === "RolePanel";
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-lg border border-midnight-500/70 bg-midnight-800/70 shadow-[0_14px_38px_rgba(5,7,18,0.22)] backdrop-blur-md transition-all duration-200 hover:border-midnight-400/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-midnight-700/70"
        aria-expanded={open}
      >
        <span className="font-fantasy text-sm tracking-wide text-amber-300">{widgetTitle(widgetKey)}</span>
        <span className={`text-sm text-parchment-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ^
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-75"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-midnight-500/50 p-3 [&>.panel]:border-0 [&>.panel]:bg-transparent [&>.panel]:p-0 [&>.panel]:shadow-none">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function widgetTitle(widgetKey: string): string {
  const titles: Record<string, string> = {
    RolePanel: "角色信息",
    MetricPanel: "局势指标",
    EventPanel: "事件追踪",
    FactionPanel: "阵营势力",
    EvidencePanel: "已知线索",
    SuggestedActionsPanel: "推荐行动",
    PlayerInfoPanel: "玩家情报",
  };
  return titles[widgetKey] || widgetKey;
}
