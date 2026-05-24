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
      <div className="panel min-h-[200px] flex flex-col items-center justify-center gap-3 text-parchment-500">
        <span className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-400/60 animate-spin" />
        <p className="text-lg font-fantasy">等待 GM 叙事...</p>
      </div>
    );
  }

  const moodGradients: Record<string, string> = {
    mysterious: "from-purple-500/20 to-transparent border-l-purple-500",
    tense: "from-red-500/20 to-transparent border-l-red-500",
    investigative: "from-blue-500/20 to-transparent border-l-blue-500",
    climactic: "from-amber-500/20 to-transparent border-l-amber-500",
    dramatic: "from-orange-500/20 to-transparent border-l-orange-500",
    neutral: "from-midnight-500/20 to-transparent border-l-midnight-500",
  };

  const moodIcons: Record<string, string> = {
    mysterious: "🔮",
    tense: "⚡",
    investigative: "🔍",
    climactic: "🔥",
    dramatic: "🎭",
    neutral: "📜",
  };

  const gradient = mood && moodGradients[mood] ? moodGradients[mood] : "from-amber-500/20 to-transparent border-l-amber-500";

  return (
    <div className={`panel min-h-[200px] border-l-[3px] bg-gradient-to-r ${gradient} animate-fade-in`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-fantasy text-amber-400 text-lg flex items-center gap-2">
          <span>{mood && moodIcons[mood] ? moodIcons[mood] : "📜"}</span>
          GM 叙事
        </h2>
        {(turn !== undefined || chapter !== undefined) && (
          <span className="text-xs text-parchment-500 bg-midnight-700/50 px-2.5 py-1 rounded-full border border-midnight-600/50">
            第 {chapter ?? "?"} 章 · 第 {turn ?? "?"} 回合
          </span>
        )}
      </div>
      <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed whitespace-pre-wrap text-[15px]">
        {content}
      </div>
    </div>
  );
}
