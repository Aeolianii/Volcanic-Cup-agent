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
  if (actions.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">推荐行动</h3>
        <p className="text-parchment-500 text-sm">暂无推荐行动</p>
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    low: "border-l-green-500 hover:bg-green-900/20",
    medium: "border-l-yellow-500 hover:bg-yellow-900/20",
    high: "border-l-red-500 hover:bg-red-900/20",
  };

  const riskLabels: Record<string, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-2">推荐行动</h3>
      <div className="space-y-2">
        {actions.map((action) => {
          const isPending = pendingActionId === action.id;
          return (
            <button
              key={action.id}
              onClick={() => onSelectAction(action)}
              disabled={disabled}
              aria-busy={isPending}
              className={`w-full text-left p-2 rounded border border-midnight-500 border-l-2 transition-colors ${
                riskColors[action.risk_level] || "border-l-gray-500"
              } ${isPending ? "ring-1 ring-amber-400 bg-amber-900/20" : ""} ${
                disabled ? "opacity-60 cursor-wait" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-parchment-200 font-medium">{action.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                  action.risk_level === "high" ? "bg-red-900/40 text-red-400" :
                  action.risk_level === "medium" ? "bg-yellow-900/40 text-yellow-400" :
                  "bg-green-900/40 text-green-400"
                }`}>
                  {riskLabels[action.risk_level]}
                </span>
              </div>
              {isPending && (
                <p className="text-xs text-amber-300 mt-1">已提交，正在结算...</p>
              )}
              {action.context && (
                <p className="text-xs text-parchment-500 mt-0.5">{action.context}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
