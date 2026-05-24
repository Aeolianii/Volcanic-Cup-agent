"use client";

import type { SuggestedAction } from "@/types";

interface SuggestedActionsPanelProps {
  actions: SuggestedAction[];
  onSelectAction: (action: SuggestedAction) => void;
  disabled?: boolean;
  pendingActionId?: string | null;
}

export function SuggestedActionsPanel({
  actions,
  onSelectAction,
  disabled = false,
  pendingActionId = null,
}: SuggestedActionsPanelProps) {
  const riskConfig: Record<string, { border: string; bg: string; hoverBg: string; badgeBg: string; badgeText: string; icon: string }> = {
    low: {
      border: "border-l-green-500 border-l-2",
      bg: "hover:bg-green-500/5",
      hoverBg: "hover:border-green-500/30",
      badgeBg: "bg-green-500/10",
      badgeText: "text-green-400",
      icon: "🟢",
    },
    medium: {
      border: "border-l-yellow-500 border-l-2",
      bg: "hover:bg-yellow-500/5",
      hoverBg: "hover:border-yellow-500/30",
      badgeBg: "bg-yellow-500/10",
      badgeText: "text-yellow-400",
      icon: "🟡",
    },
    high: {
      border: "border-l-red-500 border-l-2",
      bg: "hover:bg-red-500/5",
      hoverBg: "hover:border-red-500/30",
      badgeBg: "bg-red-500/10",
      badgeText: "text-red-400",
      icon: "🔴",
    },
  };

  const riskLabels: Record<string, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-3">
        <span>🎯</span> 推荐行动
        {actions.length > 0 && (
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full ml-auto">
            {actions.length}
          </span>
        )}
      </h3>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-parchment-500 gap-1">
          <span className="text-xl opacity-40">🎲</span>
          <p className="text-sm">暂无推荐行动</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            const isPending = pendingActionId === action.id;
            const risk = riskConfig[action.risk_level] || riskConfig.medium;
            return (
              <button
                key={action.id}
                onClick={() => onSelectAction(action)}
                disabled={disabled}
                aria-busy={isPending}
                className={`w-full text-left p-3 rounded-xl border border-midnight-500/60 transition-all duration-200 ${risk.border} ${risk.bg} ${risk.hoverBg} ${
                  isPending ? "ring-1 ring-amber-400/60 bg-amber-500/10 shadow-glow-amber-sm" : ""
                } ${
                  disabled ? "opacity-50 cursor-wait" : "cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm text-parchment-200 font-medium">
                    {isPending && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block mr-1.5" />
                    )}
                    {action.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border border-current/20 ${risk.badgeBg} ${risk.badgeText} whitespace-nowrap`}>
                    {riskLabels[action.risk_level]}
                  </span>
                </div>
                {isPending && (
                  <p className="text-xs text-amber-300 mt-1.5 animate-pulse">已提交，正在结算...</p>
                )}
                {action.context && (
                  <p className="text-xs text-parchment-500 mt-1 leading-relaxed">{action.context}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
