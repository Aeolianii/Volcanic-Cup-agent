"use client";

import type { PlayerView } from "@/types";

interface PlayerInfoPanelProps {
  playerView: PlayerView | null;
}

export function PlayerInfoPanel({ playerView }: PlayerInfoPanelProps) {
  if (!playerView) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">玩家情报</h3>
        <p className="text-parchment-500 text-sm">暂无情报</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">玩家情报</h3>

      <div className="space-y-3">
        {playerView.known_npcs.length > 0 && (
          <div>
            <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">
              已知 NPC ({playerView.known_npcs.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {playerView.known_npcs.map((npc) => (
                <span
                  key={npc}
                  className="text-xs bg-midnight-700 px-1.5 py-0.5 rounded text-parchment-400"
                >
                  {npc}
                </span>
              ))}
            </div>
          </div>
        )}

        {playerView.known_locations.length > 0 && (
          <div>
            <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">
              已知地点 ({playerView.known_locations.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {playerView.known_locations.map((loc) => (
                <span
                  key={loc}
                  className="text-xs bg-midnight-700 px-1.5 py-0.5 rounded text-parchment-400"
                >
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}

        {playerView.known_facts.length > 0 && (
          <div>
            <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">
              已知事实 ({playerView.known_facts.length})
            </h4>
            <ul className="text-xs text-parchment-400 list-disc list-inside">
              {playerView.known_facts.slice(0, 5).map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
              {playerView.known_facts.length > 5 && (
                <li className="text-parchment-600">
                  ...还有 {playerView.known_facts.length - 5} 条
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="text-[10px] text-parchment-600 italic">
          情报基于你的角色视角。其他角色可能有不同的信息。
        </div>
      </div>
    </div>
  );
}
