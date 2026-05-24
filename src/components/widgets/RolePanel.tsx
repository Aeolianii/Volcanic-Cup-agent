"use client";

import type { Role } from "@/types";

interface RolePanelProps {
  role: Role | null;
}

export function RolePanel({ role }: RolePanelProps) {
  if (!role) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">角色信息</h3>
        <p className="text-parchment-600 text-sm">尚未选择角色</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-4">角色信息</h3>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-700/10 border border-amber-600/20 flex items-center justify-center shrink-0">
            <span className="text-amber-400 font-fantasy text-lg">{role.name.charAt(0)}</span>
          </div>
          <div>
            <span className="text-lg font-fantasy text-parchment-100">{role.name}</span>
            <p className="text-xs text-parchment-500">{role.public_identity}</p>
          </div>
        </div>

        <div className="glass p-3">
          <h4 className="text-[11px] text-amber-500/80 uppercase tracking-wider mb-1">公开目标</h4>
          <p className="text-sm text-parchant-300">{role.public_goal}</p>
        </div>

        <div className="glass p-3 border-rose-700/20">
          <h4 className="text-[11px] text-rose-400/80 uppercase tracking-wider mb-1">秘密目标（仅你可见）</h4>
          <p className="text-sm text-rose-300/80 leading-relaxed">{role.secret_goal}</p>
        </div>

        {role.abilities.length > 0 && (
          <div>
            <h4 className="text-[11px] text-amber-500/80 uppercase tracking-wider mb-2">能力</h4>
            <div className="space-y-1.5">
              {role.abilities.map((ability) => (
                <div key={ability.id} className="glass p-2.5">
                  <span className="text-sm text-parchment-200 font-medium">{ability.name}</span>
                  <p className="text-xs text-parchment-600 mt-0.5">{ability.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[11px] text-amber-500/80 uppercase tracking-wider mb-2">初始情报</h4>
          <ul className="text-xs text-parchment-500 space-y-1">
            {role.initial_knowledge.map((k, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-700 mt-0.5">&#x2022;</span>
                {k}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
