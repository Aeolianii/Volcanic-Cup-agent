"use client";

interface EvidencePanelProps {
  evidence: string[];
  knownFacts?: string[];
}

export function EvidencePanel({ evidence, knownFacts = [] }: EvidencePanelProps) {
  const allItems = [...new Set([...evidence, ...knownFacts])];

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
            <span className="text-amber-500 text-xs mt-0.5">◆</span>
            <span className="text-xs text-parchment-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
