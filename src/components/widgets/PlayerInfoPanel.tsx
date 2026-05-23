"use client";

import type { PlayerView } from "@/types";

interface PlayerInfoPanelProps {
  playerView: PlayerView | null;
}

const ACTION_LABELS: Record<string, string> = {
  investigate: "调查",
  search: "搜索",
  track: "追踪",
  eavesdrop: "偷听",
  interrogate: "审问",
  decode: "解码",
  talk: "交谈",
  persuade: "说服",
  threaten: "威胁",
  deceive: "欺骗",
  ally: "结盟",
  betray: "背叛",
  confess: "坦白",
  command: "下令",
  summon_meeting: "召集会议",
  gain_support: "争取支持",
  coup: "政变",
  impeach: "弹劾",
  appoint: "任命",
  attack: "攻击",
  assassinate: "刺杀",
  duel: "决斗",
  ambush: "伏击",
  defend: "防御",
  buy: "购买",
  trade: "交易",
  steal: "偷取",
  transport: "运输",
  build: "建造",
};

const TARGET_LABELS: Record<string, string> = {
  temple: "圣殿",
  temple_altar: "圣坛",
  cathedral_basement: "教堂地下室",
  underground_altar: "地下祭坛",
  throne_room: "王座大厅",
  royal_library: "皇家图书馆",
  city_streets: "王城街道",
  tavern: "乌鸦酒馆",
  surroundings: "周围环境",
  current_location: "当前位置",
  self_goal: "个人目标",
  npc_archmage: "大法师",
  npc_old_king: "老国王",
  npc_bishop: "主教",
  guard: "守卫",
  all: "所有人",
  all_players: "所有玩家",
};

function formatFact(fact: string): string {
  if (!fact) return "未知情报";
  if (!fact.includes("_")) return fact;

  if (fact.startsWith("action_result_")) {
    const body = fact.replace("action_result_", "").replace(/_\d+$/, "");
    const [actionType, ...targetParts] = body.split("_");
    const action = ACTION_LABELS[actionType] || actionType;
    const targetKey = targetParts.join("_");
    const target = TARGET_LABELS[targetKey] || targetKey || "目标";
    return `你完成了一次${action}：${target}`;
  }

  if (fact.startsWith("npc_action_")) {
    const body = fact.replace("npc_action_", "").replace(/_\d+$/, "");
    const npc = TARGET_LABELS[body] || body;
    return `${npc}采取了新的行动`;
  }

  if (fact.startsWith("clue_")) {
    const targetKey = fact.replace("clue_", "").replace(/_\d+$/, "");
    const target = TARGET_LABELS[targetKey] || targetKey || "某处";
    return `你在${target}发现了一条线索`;
  }

  return fact.replace(/_/g, " ");
}

function formatLocation(location: string): string {
  return TARGET_LABELS[location] || location.replace(/_/g, " ");
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
                  {formatLocation(loc)}
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
                <li key={i}>{formatFact(fact)}</li>
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
          情报基于你的角色视角。其他角色可能掌握不同信息。
        </div>
      </div>
    </div>
  );
}
