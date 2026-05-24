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
                <span className="text-sm text-parchment-200 font-medium">{sanitizeActionDisplayText(action.label)}</span>
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
                <p className="text-xs text-parchment-500 mt-0.5">{sanitizeActionDisplayText(action.context)}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
