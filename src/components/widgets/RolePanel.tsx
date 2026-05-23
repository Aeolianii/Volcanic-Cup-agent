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
        <p className="text-parchment-500 text-sm">尚未选择角色</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">角色信息</h3>

      <div className="space-y-3">
        <div>
          <span className="text-xl font-fantasy text-parchment-100">{role.name}</span>
          <p className="text-xs text-parchment-400 mt-0.5">{role.public_identity}</p>
        </div>

        <div>
          <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">公开目标</h4>
          <p className="text-sm text-parchment-300">{role.public_goal}</p>
        </div>

        <div>
          <h4 className="text-xs text-red-500/80 uppercase tracking-wider mb-1">秘密目标</h4>
          <p className="text-sm text-red-300/80 italic">{role.secret_goal}</p>
        </div>

        {role.abilities.length > 0 && (
          <div>
            <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">能力</h4>
            <div className="space-y-1">
              {role.abilities.map((ability) => (
                <div key={ability.id} className="bg-midnight-700/50 rounded px-2 py-1">
                  <span className="text-sm text-parchment-200">{ability.name}</span>
                  <p className="text-xs text-parchment-500">{ability.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs text-amber-500/80 uppercase tracking-wider mb-1">初始情报</h4>
          <ul className="text-xs text-parchment-400 list-disc list-inside">
            {role.initial_knowledge.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
