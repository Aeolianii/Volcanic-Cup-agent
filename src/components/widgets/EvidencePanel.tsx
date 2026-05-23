"use client";

interface EvidencePanelProps {
  evidence: string[];
  knownFacts?: string[];
}

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
  connected_location: "相关地点",
  current_event: "当前事件",
  informed_npc: "知情者",
  npc_archmage: "大法师",
  npc_old_king: "老国王",
  npc_bishop: "主教",
  archmage: "大法师",
  old_king: "老国王",
  bishop: "主教",
  guard: "守卫",
};

function formatEvidence(item: string): string {
  if (!item.includes("_")) return item;

  if (item.startsWith("clue_")) {
    const targetKey = item.replace("clue_", "").replace(/_\d+$/, "");
    const target = TARGET_LABELS[targetKey] || targetKey || "某处";
    return `来自${target}的关键线索`;
  }

  if (item.startsWith("action_result_")) {
    return "一次行动带来的新发现";
  }

  return item.replace(/_/g, " ");
}

export function EvidencePanel({ evidence, knownFacts = [] }: EvidencePanelProps) {
  const allItems = [...new Set([...evidence, ...knownFacts.filter((item) => item.startsWith("clue_"))])];

  if (allItems.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">已知线索</h3>
        <p className="text-parchment-500 text-sm">尚未发现线索</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-2">
        已知线索 ({allItems.length})
      </h3>
      <div className="space-y-1.5">
        {allItems.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-2 p-1.5 rounded bg-midnight-700/30 border border-midnight-600/50"
          >
            <span className="text-amber-500 text-xs mt-0.5">•</span>
            <span className="text-xs text-parchment-300">{formatEvidence(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
