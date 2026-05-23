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
      <div className="panel min-h-[200px] flex items-center justify-center text-parchment-500">
        <p className="text-lg font-fantasy">等待 GM 叙事...</p>
      </div>
    );
  }

  const moodColors: Record<string, string> = {
    mysterious: "border-l-purple-500",
    tense: "border-l-red-500",
    investigative: "border-l-blue-500",
    climactic: "border-l-amber-500",
    dramatic: "border-l-orange-500",
    neutral: "border-l-midnight-500",
  };

  const borderColor = mood ? moodColors[mood] || "border-l-midnight-500" : "border-l-amber-500";

  return (
    <div className={`panel min-h-[200px] border-l-4 ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-fantasy text-amber-400 text-lg">GM 叙事</h2>
        {(turn !== undefined || chapter !== undefined) && (
          <span className="text-xs text-parchment-500">
            第 {chapter} 章 · 第 {turn} 回合
          </span>
        )}
      </div>
      <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
