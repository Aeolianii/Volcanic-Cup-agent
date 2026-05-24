"use client";

interface EvidencePanelProps {
  evidence: string[];
  knownFacts?: string[];
}

function formatEvidence(item: string): string {
  const text = String(item || "").trim();
  if (!text) return text;

  const actionMatch = text.match(/^Action completed:\s*([a-z_]+)\s*->\s*(.+)\.?$/i);
  if (actionMatch) {
    return `已完成${actionLabel(actionMatch[1])}：${formatId(actionMatch[2])}。`;
  }

  const clueMatch = text.match(/^Clue found at\s+(.+)\.?$/i);
  if (clueMatch) {
    return `来自${formatId(clueMatch[1])}的线索。`;
  }

  if (text.startsWith("clue_")) {
    return `来自${formatId(text.replace(/^clue_/, ""))}的线索`;
  }

  if (text.startsWith("false_evidence_")) return "一条可疑线索";
  if (text.startsWith("npc_action_")) return "某个角色的暗中行动";

  if (/^[a-z]+(_[a-z0-9]+)+$/i.test(text)) {
    return formatId(text);
  }

  return text;
}

function formatId(value: string): string {
  const id = value.trim().replace(/\.$/, "");
  const labels: Record<string, string> = {
    current_location: "当前位置", connected_location: "相关地点",
    current_event: "当前事件", all_players: "所有玩家",
    temple: "圣殿", cathedral_basement: "教堂地下室",
    underground_altar: "地下祭坛", throne_room: "王座大厅",
    royal_library: "皇家图书馆", city_streets: "王城街道", tavern: "酒馆",
    npc_archmage: "大法师", npc_old_king: "老国王", npc_bishop: "主教",
    ancient_runes_discovered: "古老符文线索",
  };
  return labels[id] || id.replace(/^npc_/, "").replace(/^role_/, "").replace(/_/g, " ");
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    investigate: "调查", search: "搜索", track: "追踪", eavesdrop: "偷听",
    interrogate: "盘问", decode: "解读", talk: "交谈", persuade: "说服",
    threaten: "威胁", deceive: "欺骗",
  };
  return labels[actionType] || actionType.replace(/_/g, " ");
}

export function EvidencePanel({ evidence, knownFacts = [] }: EvidencePanelProps) {
  const clueFacts = knownFacts.filter((item) =>
    item.startsWith("clue_") ||
    item.startsWith("Clue found at") ||
    item.startsWith("false_evidence_")
  );
  const allItems = [...new Set([...evidence, ...clueFacts])]
    .map(formatEvidence)
    .filter(Boolean);

  if (allItems.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">已知线索</h3>
        <p className="text-parchment-600 text-sm">尚未发现线索</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">
        已知线索 ({allItems.length})
      </h3>
      <div className="space-y-1.5">
        {allItems.map((item, i) => (
          <div
            key={`${item}_${i}`}
            className="flex items-start gap-2.5 p-2.5 rounded-lg glass border-midnight-600/30"
          >
            <span className="text-amber-600 text-xs mt-0.5 shrink-0">&#x2022;</span>
            <span className="text-xs text-parchment-400 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
