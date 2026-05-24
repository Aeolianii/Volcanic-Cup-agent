"use client";

import type { VisibleFaction } from "@/types";

interface FactionPanelProps {
  factions: VisibleFaction[];
  memberLabels?: Record<string, string>;
}

export function FactionPanel({ factions, memberLabels = {} }: FactionPanelProps) {
  if (factions.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">阵营</h3>
        <p className="text-parchment-500 text-sm">暂无阵营信息</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-2">阵营势力</h3>
      <div className="space-y-3">
        {factions.map((faction) => (
          <div
            key={faction.id}
            className="p-2 rounded border border-midnight-600 bg-midnight-700/30"
          >
            <h4 className="text-sm font-medium text-parchment-200 mb-1">{faction.name}</h4>
            <p className="text-xs text-parchment-500 mb-2">{faction.description}</p>

            {faction.goals.length > 0 && (
              <div className="mb-1">
                <span className="text-[10px] text-amber-500/80 uppercase">目标</span>
                <ul className="text-xs text-parchment-400 list-disc list-inside mt-0.5">
                  {faction.goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {faction.known_members.length > 0 && (
              <div>
                <span className="text-[10px] text-amber-500/80 uppercase">已知成员</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {faction.known_members.map((member) => (
                    <span
                      key={member}
                      className="text-[10px] bg-midnight-600 px-1.5 py-0.5 rounded text-parchment-400"
                    >
                      {memberLabels[member] || member}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
