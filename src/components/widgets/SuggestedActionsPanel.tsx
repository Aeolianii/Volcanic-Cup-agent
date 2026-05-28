"use client";

import type { SuggestedAction } from "@/types";

interface SuggestedActionsPanelProps {
  actions: SuggestedAction[];
  onSelectAction: (action: SuggestedAction) => void;
  disabled?: boolean;
  pendingActionId?: string | null;
}

function sanitizeActionDisplayText(text: unknown): string {
  let output = String(text || "");
  const replacements: Array<[RegExp, string]> = [
    [/\bcurrent_location\b/g, "当前位置"],
    [/\bconnected_location\b/g, "相关地点"],
    [/\bcurrent_event\b/g, "当前事件"],
    [/\bself_goal\b/g, "自己的目标"],
    [/\bpublic_situation\b/g, "公开局势"],
    [/\ball_players\b/g, "所有玩家"],
    [/\binformed_npc\b/g, "知情者"],
    [/\bunknown\b/g, "当前目标"],
    [/\btruth_progress\b/g, "真相进度"],
    [/\bsituation_stability\b/g, "局势稳定度"],
    [/\bfaction_power\b/g, "势力值"],
    [/\btrust\b/g, "信任度"],
    [/\bsuspicion\b/g, "怀疑度"],
  ];

  for (const [pattern, label] of replacements) {
    output = output.replace(pattern, label);
  }

  return output
    .replace(/\brole_(\d+)\b/gi, "角色 $1")
    .replace(/\bnpc_([a-z0-9_]+)\b/gi, "相关人物")
    .replace(/\bevt_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bevent_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\blocation_([a-z0-9_]+)\b/gi, "相关地点")
    .replace(/\bplayer_([a-z0-9_]+)\b/gi, "玩家")
    .replace(/\b[a-z]+(?:_[a-z0-9]+){2,}\b/gi, "相关条目");
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
        <p className="text-parchment-600 text-sm">暂无推荐行动</p>
      </div>
    );
  }

  const riskStyles: Record<string, { border: string; hover: string; badge: string }> = {
    low: {
      border: "border-l-emerald-500",
      hover: "hover:bg-emerald-900/10 hover:border-emerald-600/30",
      badge: "badge-emerald",
    },
    medium: {
      border: "border-l-amber-500",
      hover: "hover:bg-amber-900/10 hover:border-amber-600/30",
      badge: "badge-amber",
    },
    high: {
      border: "border-l-rose-500",
      hover: "hover:bg-rose-900/10 hover:border-rose-600/30",
      badge: "badge-rose",
    },
  };

  const riskLabels: Record<string, string> = {
    low: "低风险", medium: "中风险", high: "高风险",
  };

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">推荐行动</h3>
      <div className="space-y-2">
        {actions.map((action) => {
          const isPending = pendingActionId === action.id;
          const style = riskStyles[action.risk_level] || riskStyles.medium;
          return (
            <button
              key={action.id}
              onClick={() => onSelectAction(action)}
              disabled={disabled}
              aria-busy={isPending}
              className={`w-full text-left p-3 rounded-xl border border-midnight-600/50 border-l-[3px] transition-all duration-200 ${
                style.border
              } ${style.hover} ${
                isPending ? "ring-1 ring-amber-400/50 bg-amber-900/15" : ""
              } ${
                disabled ? "opacity-60 cursor-wait" : "cursor-pointer"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-parchment-200 font-medium leading-snug">
                  {sanitizeActionDisplayText(action.label)}
                </span>
                <span className={`${style.badge} text-[10px] shrink-0`}>
                  {riskLabels[action.risk_level]}
                </span>
              </div>
              {isPending && (
                <p className="text-xs text-amber-300 mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  已提交，正在结算...
                </p>
              )}
              {action.context && (
                <p className="text-xs text-parchment-600 mt-1.5">
                  {sanitizeActionDisplayText(action.context)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
