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
        <p className="text-parchment-600 text-sm">暂无阵营信息</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">阵营势力</h3>
      <div className="space-y-3">
        {factions.map((faction) => (
          <div
            key={faction.id}
            className="glass p-3.5"
          >
            <h4 className="text-sm font-medium text-parchment-200 mb-1.5">{faction.name}</h4>
            <p className="text-xs text-parchment-600 mb-3 leading-relaxed">{faction.description}</p>

            {faction.goals.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] text-amber-500/80 uppercase tracking-wider">目标</span>
                <ul className="text-xs text-parchment-500 space-y-0.5 mt-1">
                  {faction.goals.map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-800 mt-0.5">&#x2022;</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {faction.known_members.length > 0 && (
              <div>
                <span className="text-[10px] text-amber-500/80 uppercase tracking-wider">已知成员</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {faction.known_members.map((member) => (
                    <span
                      key={member}
                      className="badge-blue text-[10px]"
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
