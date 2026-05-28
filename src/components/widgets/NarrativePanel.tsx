"use client";

interface NarrativePanelProps {
  content: string;
  mood?: string;
  turn?: number;
  chapter?: number;
}

export function NarrativePanel({ content, mood, turn, chapter }: NarrativePanelProps) {
  if (!content) {
    return (
      <div className="panel min-h-[200px] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-600/15 border-t-amber-400/50 animate-spin" />
        <p className="text-parchment-600 text-sm font-fantasy">等待 GM 叙事...</p>
      </div>
    );
  }

  const moodColors: Record<string, string> = {
    mysterious: "border-l-purple-500 shadow-purple-500/5",
    tense: "border-l-red-500 shadow-red-500/5",
    investigative: "border-l-blue-500 shadow-blue-500/5",
    climactic: "border-l-amber-500 shadow-amber-500/5",
    dramatic: "border-l-orange-500 shadow-orange-500/5",
    neutral: "border-l-midnight-500",
  };

  const borderColor = mood ? moodColors[mood] || "border-l-amber-500" : "border-l-amber-500";

  return (
    <div className={`panel min-h-[200px] border-l-4 ${borderColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-fantasy text-amber-400 text-base tracking-wide">GM 叙事</h2>
        {(turn !== undefined || chapter !== undefined) && (
          <span className="badge-amber text-xs">
            第 {chapter} 章 &middot; 第 {turn} 回合
          </span>
        )}
      </div>
      <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed whitespace-pre-wrap text-[15px]">
        {content}
      </div>
    </div>
  );
}
