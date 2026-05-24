"use client";

import type { Role } from "@/types";

interface RolePanelProps {
  role: Role | null;
  knownFacts?: string[];
}

export function RolePanel({ role, knownFacts = [] }: RolePanelProps) {
  if (!role) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-3">
          <span>角色</span> 角色信息
        </h3>
        <div className="flex flex-col items-center justify-center py-6 text-parchment-500 gap-1">
          <p className="text-sm">尚未选择角色</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full overflow-hidden">
      <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-4">
        <span>角色</span> 角色信息
      </h3>

      <div className="space-y-4 max-h-[calc(100vh-170px)] overflow-y-auto pr-1">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <span className="font-fantasy text-lg text-amber-400">{role.name.charAt(0)}</span>
          </div>
          <div>
            <span className="text-lg font-fantasy text-parchment-100">{role.name}</span>
            <p className="text-xs text-parchment-400 mt-0.5">{role.public_identity}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-midnight-700/30 border border-midnight-600/30">
          <h4 className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium mb-1.5">公开目标</h4>
          <p className="text-sm text-parchment-300 leading-relaxed">{role.public_goal}</p>
        </div>

        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
          <h4 className="text-[10px] text-red-400/70 uppercase tracking-wider font-medium mb-1.5">
            秘密目标（仅你可见）
          </h4>
          <p className="text-sm text-red-300/80 italic leading-relaxed">{role.secret_goal}</p>
        </div>

        {role.abilities.length > 0 && (
          <div>
            <h4 className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium mb-2">能力</h4>
            <div className="space-y-1.5">
              {role.abilities.map((ability) => (
                <div
                  key={ability.id}
                  className="bg-midnight-700/40 rounded-lg px-3 py-2 border border-midnight-600/30"
                >
                  <span className="text-sm text-parchment-200 font-medium">{ability.name}</span>
                  <p className="text-xs text-parchment-500 mt-0.5">{ability.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {knownFacts.length > 0 && (
          <div>
            <h4 className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium mb-2">初始情报</h4>
            <ul className="text-xs text-parchment-400 space-y-1">
              {knownFacts.slice(0, 8).map((fact, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5 shrink-0">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
