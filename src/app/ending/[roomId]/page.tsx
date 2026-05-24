"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

interface ChronicleEntry {
  turn: number;
  chapter: number;
  round: number;
  title: string;
  description: string;
  type: "event_triggered" | "round_end" | "chapter_transition" | "flag_set";
}

interface PlayerActionRecord {
  player_id: string;
  player_name: string;
  role_name: string;
  is_ai: boolean;
  actions: {
    turn: number;
    action_type: string;
    target: string;
    method: string;
    intent: string;
    summary: string;
  }[];
  total_actions: number;
}

interface TruthReveal {
  story_title: string;
  ending_title: string;
  core_truth: string;
  public_knowledge: string[];
  key_flags: { flag: string; value: boolean }[];
  final_metrics: { metric: string; label: string; value: unknown }[];
}

interface GMEvaluation {
  player_id: string;
  player_name: string;
  role_name: string;
  is_ai: boolean;
  commentary: string;
  rating: number;
}

interface EndingData {
  ending: {
    id: string;
    title: string;
    description: string;
  } | null;
  all_endings_status: {
    ending_id: string;
    title: string;
    conditions_met: number;
    total_conditions: number;
    progress: number;
  }[];
  victory_settlement?: {
    player_id: string;
    role_id: string | null;
    faction_id?: string;
    faction_victory: boolean;
    personal_victory: boolean;
    life_status: string;
    notes: string[];
  }[];
  ending_narrative: string;
  chronicle: ChronicleEntry[];
  all_player_actions: PlayerActionRecord[];
  truth_reveal: TruthReveal;
  gm_evaluations: GMEvaluation[];
  mvp_player_id: string;
}

export default function EndingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const endingId = searchParams.get("ending_id");

  const [data, setData] = useState<EndingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "chronicle" | "actions" | "truth" | "evaluations">("overview");

  useEffect(() => {
    const fetchEnding = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/endings/check`, {
          method: "POST",
        });
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch {
        // Use mock data
      } finally {
        setLoading(false);
      }
    };

    fetchEnding();
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
        <p className="text-parchment-500 text-lg animate-pulse">正在编织命运之线...</p>
      </div>
    );
  }

  const currentEnding = data?.all_endings_status?.find((e) => e.ending_id === endingId);
  const mvpPlayer = data?.gm_evaluations?.find((e) => e.player_id === data.mvp_player_id);
  const tabs = [
    { key: "overview" as const, label: "终章", icon: "🏆" },
    { key: "chronicle" as const, label: "编年史", icon: "📜" },
    { key: "actions" as const, label: "行动记录", icon: "⚔️" },
    { key: "truth" as const, label: "真相", icon: "🔍" },
    { key: "evaluations" as const, label: "GM 点评", icon: "🎖️" },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Ending Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs mb-6 tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          故事终章
        </div>
        <h1 className="font-fantasy text-4xl md:text-5xl text-amber-400 mb-4 tracking-wider">
          {data?.ending?.title || "故事结束"}
        </h1>
        <p className="text-parchment-500 text-lg max-w-xl mx-auto">
          {data?.ending?.description || "命运之线已经编织完毕..."}
        </p>
      </div>

      {/* MVP Banner */}
      {mvpPlayer && (
        <div className="panel-highlight mb-8 text-center animate-fade-in-up relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent rounded-full" />
          <div className="text-5xl mb-3 animate-float">👑</div>
          <h2 className="font-fantasy text-2xl text-amber-300 mb-2">MVP 玩家</h2>
          <p className="text-xl text-amber-200 font-bold mb-1">
            {mvpPlayer.is_ai
              ? `机器人${getAIIndex(mvpPlayer.player_id, data?.gm_evaluations)}号（扮演${mvpPlayer.role_name}）`
              : `${mvpPlayer.player_name}（${mvpPlayer.role_name}）`}
          </p>
          <p className="text-parchment-400 text-sm max-w-lg mx-auto mt-2">{mvpPlayer.commentary}</p>
          <div className="mt-3 flex items-center justify-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i < mvpPlayer.rating ? "bg-amber-400" : "bg-midnight-600"}`}
              />
            ))}
            <span className="text-xs text-amber-400 ml-2">{mvpPlayer.rating}/10</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-sm px-4 py-2 rounded-full border transition-all duration-200 ${
              activeTab === tab.key
                ? "border-amber-500/50 bg-amber-500/10 text-amber-200 shadow-glow-amber-sm"
                : "border-midnight-600/50 bg-midnight-700/30 text-parchment-400 hover:border-amber-500/30 hover:text-parchment-300"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Ending Narrative */}
            {data?.ending_narrative && (
              <div className="panel-highlight animate-fade-in-up">
                <div className="section-title mb-4">终章叙事</div>
                <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed whitespace-pre-wrap text-[15px]">
                  {data.ending_narrative}
                </div>
              </div>
            )}

            {/* Victory Settlement */}
            {data?.victory_settlement && data.victory_settlement.length > 0 && (
              <div className="panel animate-fade-in-up">
                <div className="section-title mb-4">胜利结算</div>
                <div className="space-y-3">
                  {data.victory_settlement.map((item) => (
                    <div
                      key={item.player_id}
                      className="p-4 rounded-xl border border-midnight-600/60 bg-midnight-700/30 hover:border-midnight-500/60 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400">
                            {(item.role_id || item.player_id).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-parchment-200 font-medium">{item.role_id || item.player_id}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${
                          item.life_status === "alive"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : item.life_status === "dead"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-midnight-600/50 text-parchment-500 border-midnight-500/30"
                        }`}>
                          {lifeStatusLabel(item.life_status)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          item.faction_victory ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-midnight-700/50"
                        }`}>
                          <span className="text-lg">{item.faction_victory ? "🏆" : "—"}</span>
                          <span className={item.faction_victory ? "text-emerald-300" : "text-parchment-500"}>
                            阵营胜利
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          item.personal_victory ? "bg-amber-500/10 border border-amber-500/20" : "bg-midnight-700/50"
                        }`}>
                          <span className="text-lg">{item.personal_victory ? "👑" : "—"}</span>
                          <span className={item.personal_victory ? "text-amber-300" : "text-parchment-500"}>
                            个人胜利
                          </span>
                        </div>
                      </div>
                      {item.notes.length > 0 && (
                        <p className="text-xs text-parchment-500 mt-3 pt-3 border-t border-midnight-600/50">
                          {item.notes.join("；")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Endings Status */}
            {data?.all_endings_status && data.all_endings_status.length > 0 && (
              <div className="panel animate-fade-in-up">
                <div className="section-title mb-4">所有可能结局</div>
                <div className="space-y-3">
                  {data.all_endings_status.map((es) => {
                    const isAchieved = es.ending_id === endingId;
                    return (
                      <div
                        key={es.ending_id}
                        className={`p-4 rounded-xl border transition-all duration-300 ${
                          isAchieved
                            ? "border-amber-500/40 bg-amber-500/5 shadow-glow-amber-sm"
                            : "border-midnight-600/40 bg-midnight-700/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${
                              isAchieved ? "text-amber-200" : "text-parchment-300"
                            }`}>
                              {es.title}
                            </span>
                            {isAchieved && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                已达成
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-parchment-500 font-mono">
                            {es.conditions_met}/{es.total_conditions}
                          </span>
                        </div>
                        <div className="w-full bg-midnight-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                              isAchieved
                                ? "bg-gradient-to-r from-amber-500 to-amber-400 shadow-glow-amber-sm"
                                : "bg-midnight-500"
                            }`}
                            style={{ width: `${Math.max(4, es.progress)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chronicle Tab */}
        {activeTab === "chronicle" && (
          <div className="panel animate-fade-in-up">
            <div className="section-title mb-4">世界编年史</div>
            <p className="text-xs text-parchment-500 mb-6">按时间顺序记录的所有世界事件和发展</p>

            {data?.chronicle && data.chronicle.length > 0 ? (
              <div className="relative pl-8 border-l-2 border-midnight-600/50 space-y-6">
                {data.chronicle.map((entry, i) => (
                  <div key={i} className="relative animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                    {/* Timeline dot */}
                    <div className={`absolute -left-[calc(2rem+5px)] w-3 h-3 rounded-full border-2 ${
                      entry.type === "event_triggered"
                        ? "bg-amber-500/20 border-amber-400"
                        : entry.type === "round_end"
                        ? "bg-blue-500/20 border-blue-400"
                        : entry.type === "chapter_transition"
                        ? "bg-purple-500/20 border-purple-400"
                        : "bg-emerald-500/20 border-emerald-400"
                    }`} />

                    {/* Entry content */}
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        entry.type === "event_triggered"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : entry.type === "round_end"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      }`}>
                        {entry.type === "event_triggered" ? "世界事件" :
                         entry.type === "round_end" ? "回合结束" :
                         entry.type === "chapter_transition" ? "章节过渡" : "旗帜设定"}
                      </span>
                      <span className="text-xs text-parchment-500 font-mono">
                        第 {entry.chapter} 章 · 第 {entry.round} 回合 · T{entry.turn}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-parchment-200">{entry.title}</h4>
                    {entry.description && (
                      <p className="text-xs text-parchment-500 mt-1 leading-relaxed">{entry.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-parchment-500 gap-2">
                <span className="text-2xl opacity-40">📜</span>
                <p className="text-sm">暂无编年史记录</p>
              </div>
            )}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === "actions" && (
          <div className="space-y-6 animate-fade-in-up">
            {data?.all_player_actions && data.all_player_actions.length > 0 ? (
              data.all_player_actions.map((player, i) => {
                const aiLabel = player.is_ai
                  ? `机器人${getAIIndex(player.player_id, data.gm_evaluations)}号（扮演${player.role_name}）`
                  : `${player.player_name}（${player.role_name}）`;

                return (
                  <div key={player.player_id} className="panel" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-fantasy text-amber-400 text-sm flex items-center gap-2">
                        <span>{player.is_ai ? "🤖" : "👤"}</span>
                        {aiLabel}
                      </h4>
                      <span className="text-xs bg-midnight-700/70 px-2 py-1 rounded-full border border-midnight-500/40 text-parchment-400">
                        共 {player.total_actions} 次行动
                      </span>
                    </div>

                    {player.actions.length > 0 ? (
                      <div className="space-y-1.5">
                        {player.actions.map((action, j) => (
                          <div
                            key={j}
                            className="flex items-start gap-3 p-2.5 rounded-lg bg-midnight-700/30 border border-midnight-600/30 text-sm"
                          >
                            <span className="text-[10px] text-parchment-500 font-mono whitespace-nowrap mt-0.5 bg-midnight-800/70 px-1.5 py-0.5 rounded">
                              T{action.turn}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-parchment-200">{action.summary}</span>
                              {action.target && (
                                <span className="text-parchment-500 text-xs ml-2">
                                  → {action.target}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-parchment-600 bg-midnight-800/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {actionLabel(action.action_type)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-parchment-500 py-3 text-center">无公开行动记录</p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="panel">
                <div className="flex flex-col items-center py-10 text-parchment-500 gap-2">
                  <span className="text-2xl opacity-40">⚔️</span>
                  <p className="text-sm">暂无行动记录</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Truth Tab */}
        {activeTab === "truth" && (
          <div className="space-y-6 animate-fade-in-up">
            {data?.truth_reveal && (
              <>
                {/* Core Truth */}
                <div className="panel-highlight">
                  <div className="section-title mb-4">事件真相</div>
                  <h3 className="text-lg font-fantasy text-amber-300 mb-3">{data.truth_reveal.ending_title}</h3>
                  <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed text-[15px]">
                    {data.truth_reveal.core_truth}
                  </div>
                </div>

                {/* Public Knowledge */}
                {data.truth_reveal.public_knowledge.length > 0 && (
                  <div className="panel">
                    <div className="section-title mb-4">公开信息</div>
                    <div className="space-y-2">
                      {data.truth_reveal.public_knowledge.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-midnight-700/30 border border-midnight-600/30">
                          <span className="text-amber-500 text-xs mt-0.5 shrink-0">◆</span>
                          <span className="text-sm text-parchment-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Flags */}
                {data.truth_reveal.key_flags.length > 0 && (
                  <div className="panel">
                    <div className="section-title mb-4">关键状态</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {data.truth_reveal.key_flags.map((f) => (
                        <div
                          key={f.flag}
                          className={`p-2.5 rounded-lg text-xs border ${
                            f.value
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-midnight-700/30 border-midnight-600/30"
                          }`}
                        >
                          <span className={`font-medium ${f.value ? "text-emerald-300" : "text-parchment-500"}`}>
                            {f.value ? "✓" : "✗"} {formatFlagName(f.flag)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Metrics */}
                {data.truth_reveal.final_metrics.length > 0 && (
                  <div className="panel">
                    <div className="section-title mb-4">最终指标</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {data.truth_reveal.final_metrics.map((m) => (
                        <div key={m.metric} className="p-3 rounded-xl bg-midnight-700/30 border border-midnight-600/30 text-center">
                          <p className="text-xs text-parchment-500 mb-1">{m.label}</p>
                          <p className="text-lg font-bold text-amber-400">{String(m.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!data?.truth_reveal && (
              <div className="panel">
                <div className="flex flex-col items-center py-10 text-parchment-500 gap-2">
                  <span className="text-2xl opacity-40">🔍</span>
                  <p className="text-sm">真相仍在迷雾中</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GM Evaluations Tab */}
        {activeTab === "evaluations" && (
          <div className="space-y-4 animate-fade-in-up">
            {data?.gm_evaluations && data.gm_evaluations.length > 0 ? (
              data.gm_evaluations.map((evaluation, i) => {
                const displayName = evaluation.is_ai
                  ? `机器人${getAIIndex(evaluation.player_id, data.gm_evaluations)}号（扮演${evaluation.role_name}）`
                  : `${evaluation.player_name}（${evaluation.role_name}）`;
                const isMvp = evaluation.player_id === data.mvp_player_id;

                return (
                  <div
                    key={evaluation.player_id}
                    className={`panel relative overflow-hidden animate-fade-in-up ${
                      isMvp ? "border-amber-500/40 shadow-glow-amber-sm" : ""
                    }`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {isMvp && (
                      <div className="absolute top-3 right-3 text-lg animate-float">👑</div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        evaluation.is_ai
                          ? "bg-blue-500/10 border border-blue-500/30"
                          : "bg-amber-500/10 border border-amber-500/30"
                      }`}>
                        <span className="text-lg">{evaluation.is_ai ? "🤖" : "👤"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-parchment-200">{displayName}</h4>
                          {evaluation.is_ai && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                              AI 代演
                            </span>
                          )}
                          {isMvp && (
                            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                              MVP
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-parchment-400 leading-relaxed">{evaluation.commentary}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-xl font-bold text-amber-400">{evaluation.rating}</span>
                        <span className="text-xs text-parchment-500">/10</span>
                      </div>
                    </div>
                    {/* Rating bar */}
                    <div className="mt-3 w-full bg-midnight-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000"
                        style={{ width: `${evaluation.rating * 10}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="panel">
                <div className="flex flex-col items-center py-10 text-parchment-500 gap-2">
                  <span className="text-2xl opacity-40">🎖️</span>
                  <p className="text-sm">暂无 GM 点评</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center mt-10 animate-fade-in-up">
        <button onClick={() => router.push("/")} className="btn-primary px-8">
          返回首页
        </button>
        <button onClick={() => router.push("/generate")} className="btn-secondary px-8">
          创建新故事
        </button>
      </div>

      {/* Footer decoration */}
      <div className="text-center mt-12 text-parchment-600 text-xs">
        <div className="inline-flex items-center gap-3">
          <span className="w-8 h-px bg-gradient-to-r from-transparent to-midnight-500" />
          <span>故事已完结，命运已成定局</span>
          <span className="w-8 h-px bg-gradient-to-l from-transparent to-midnight-500" />
        </div>
      </div>
    </div>
  );
}

function getAIIndex(playerId: string, evaluations?: GMEvaluation[]): number {
  if (!evaluations) return 1;
  const aiPlayers = evaluations.filter((e) => e.is_ai);
  const idx = aiPlayers.findIndex((e) => e.player_id === playerId);
  return idx >= 0 ? idx + 1 : 1;
}

function lifeStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    alive: "存活",
    dead: "阵亡",
    missing: "失踪",
    imprisoned: "囚禁",
    defeated: "落败",
    setback: "受挫",
  };
  return labels[status] || status;
}

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    investigate: "调查",
    search: "搜索",
    track: "追踪",
    eavesdrop: "偷听",
    interrogate: "盘问",
    decode: "解读",
    spy: "间谍",
    talk: "交谈",
    persuade: "说服",
    threaten: "威胁",
    deceive: "欺骗",
    ally: "结盟",
    betray: "背叛",
    confess: "坦白",
    command: "下令",
    summon_meeting: "召集",
    gain_support: "争取",
    coup: "夺权",
    impeach: "弹劾",
    appoint: "任命",
    attack: "攻击",
    assassinate: "刺杀",
    duel: "决斗",
    ambush: "伏击",
    defend: "防守",
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
    execute: "处决",
    sacrifice: "献祭",
    divination: "预言",
    gather_intelligence: "情报",
  };
  return labels[type] || type;
}

function formatFlagName(flag: string): string {
  const labels: Record<string, string> = {
    truth_revealed: "真相已揭露",
    traitor_identified: "叛徒已找出",
    all_clues_found: "所有线索已发现",
    final_decision_submitted: "最终决定已提交",
    force_ending: "强制结束",
  };
  if (labels[flag]) return labels[flag];
  return flag
    .replace(/^flag_/, "")
    .replace(/^personal_victory_/, "个人胜利_")
    .replace(/_/g, " ");
}
