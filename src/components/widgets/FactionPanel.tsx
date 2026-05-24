"use client";

import type { VisibleFaction } from "@/types";

interface FactionPanelProps {
  factions: VisibleFaction[];
  memberLabels?: Record<string, string>;
}

export function FactionPanel({ factions, memberLabels = {} }: FactionPanelProps) {
  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-3">
        <span>🏰</span> 阵营势力
        {factions.length > 0 && (
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full ml-auto">
            {factions.length}
          </span>
        )}
      </h3>

      {factions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-parchment-500 gap-1">
          <span className="text-xl opacity-40">🏳️</span>
          <p className="text-sm">暂无阵营信息</p>
        </div>
      ) : (
        <div className="space-y-3">
          {factions.map((faction) => (
            <div
              key={faction.id}
              className="p-3.5 rounded-xl border border-midnight-600/50 bg-midnight-700/30 hover:border-midnight-500/60 transition-all duration-200"
            >
              <h4 className="text-sm font-semibold text-parchment-200 mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {faction.name}
              </h4>
              <p className="text-xs text-parchment-400 mb-3 leading-relaxed">{faction.description}</p>

              {faction.goals.length > 0 && (
                <div className="mb-2.5">
                  <span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium">目标</span>
                  <ul className="text-xs text-parchment-400 mt-1 space-y-0.5">
                    {faction.goals.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-600 mt-0.5">•</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {faction.known_members.length > 0 && (
                <div>
                  <span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium">已知成员</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {faction.known_members.map((member) => (
                      <span
                        key={member}
                        className="text-[10px] bg-midnight-600/70 px-2 py-1 rounded-full text-parchment-300 border border-midnight-500/40"
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
      )}
    </div>
  );
}
