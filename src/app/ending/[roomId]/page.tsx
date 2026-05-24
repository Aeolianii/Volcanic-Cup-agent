"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

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
    player_name?: string;
    role_id: string | null;
    role_name?: string;
    faction_id?: string;
    faction_name?: string;
    faction_victory: boolean;
    personal_victory: boolean;
    life_status: string;
    notes: string[];
  }[];
  ending_narrative: string;
  ending_recap?: {
    truth: {
      title: string;
      content: string;
      source: string;
    }[];
    chronicle: {
      turn: number;
      title: string;
      description: string;
      trigger_reason: string;
    }[];
    player_actions: {
      id: string;
      turn: number;
      actor_id: string;
      actor_display_name: string;
      actor_type: "human_player" | "ai_player_role" | "npc";
      action_type: string;
      action_label: string;
      target_display_name: string;
      method: string;
      intent: string;
      risk_level: "low" | "medium" | "high";
      success: boolean;
      public_result: string;
      raw_input?: string;
    }[];
    gm_reviews: {
      player_id: string;
      display_name: string;
      kind: "human_player" | "ai_player_role";
      score: number;
      highlights: string[];
      gm_comment: string;
    }[];
    mvp: {
      player_id: string;
      display_name: string;
      kind: "human_player" | "ai_player_role";
      score: number;
      gm_comment: string;
    } | null;
  };
}

export default function EndingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const endingId = searchParams.get("ending_id");

  const [data, setData] = useState<EndingData | null>(null);
  const [loading, setLoading] = useState(true);

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
        // 保持结算页可用，失败时只结束加载状态
      } finally {
        setLoading(false);
      }
    };

    fetchEnding();
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-parchant-500 text-lg">计算结局中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="font-fantasy text-4xl text-amber-400 mb-2">
          {data?.ending?.title || "故事结束"}
        </h1>
        <p className="text-parchant-500 text-lg">
          {data?.ending?.description || "命运之线已经编织完毕..."}
        </p>
      </div>

      {data?.ending_narrative && (
        <div className="panel mb-8">
          <div className="prose prose-invert max-w-none text-parchant-200 leading-relaxed whitespace-pre-wrap">
            {sanitizeSettlementText(data.ending_narrative)}
          </div>
        </div>
      )}

      {data?.ending_recap && (
        <div className="space-y-8 mb-8">
          {data.ending_recap.mvp && (
            <div className="panel border-amber-500/60 bg-amber-950/20">
              <p className="text-xs uppercase tracking-wider text-amber-500 mb-2">MVP</p>
              <h3 className="font-fantasy text-2xl text-amber-300 mb-2">
                {sanitizeSettlementText(data.ending_recap.mvp.display_name)}
              </h3>
              <p className="text-sm text-parchant-300">
                贡献分：{data.ending_recap.mvp.score}
              </p>
              <p className="text-parchant-200 mt-3 leading-relaxed">
                {sanitizeSettlementText(data.ending_recap.mvp.gm_comment)}
              </p>
            </div>
          )}

          {data.ending_recap.truth.length > 0 && (
            <div className="panel">
              <h3 className="font-fantasy text-amber-400 mb-4">事件真相公开</h3>
              <div className="space-y-3">
                {data.ending_recap.truth.map((item, index) => (
                  <div key={`${item.title}_${index}`} className="border-l-2 border-amber-500/50 pl-3">
                    <p className="text-parchant-100 font-medium">{sanitizeSettlementText(item.title)}</p>
                    <p className="text-sm text-parchant-400 leading-relaxed whitespace-pre-wrap">
                      {sanitizeSettlementText(item.content)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.ending_recap.chronicle.length > 0 && (
            <div className="panel">
              <h3 className="font-fantasy text-amber-400 mb-4">事件编年史</h3>
              <div className="space-y-3">
                {data.ending_recap.chronicle.map((item, index) => (
                  <div key={`${item.title}_${index}`} className="p-3 rounded border border-midnight-600 bg-midnight-700/30">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-amber-400">第 {item.turn} 回合</span>
                      <span className="text-parchant-100 font-medium">{sanitizeSettlementText(item.title)}</span>
                    </div>
                    <p className="text-sm text-parchant-400 leading-relaxed">{sanitizeSettlementText(item.description)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.ending_recap.player_actions.length > 0 && (
            <div className="panel">
              <h3 className="font-fantasy text-amber-400 mb-4">所有玩家操作公开</h3>
              <div className="space-y-3">
                {data.ending_recap.player_actions.map((action) => (
                  <div key={action.id} className="p-3 rounded border border-midnight-600 bg-midnight-700/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-parchant-100 font-medium">
                        第 {action.turn} 回合 · {sanitizeSettlementText(action.actor_display_name)}
                      </span>
                      <span className={action.success ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
                        {action.success ? "成功" : "失败"} · {sanitizeSettlementText(action.action_label)}
                      </span>
                    </div>
                    <p className="text-sm text-parchant-400">
                      目标：{sanitizeSettlementText(action.target_display_name || "未知")}；意图：{sanitizeSettlementText(action.intent)}
                    </p>
                    <p className="text-sm text-parchant-300 mt-1">{sanitizeSettlementText(action.public_result)}</p>
                    {action.raw_input && (
                      <p className="text-xs text-parchant-500 mt-1">原始输入：{sanitizeSettlementText(action.raw_input)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.ending_recap.gm_reviews.length > 0 && (
            <div className="panel">
              <h3 className="font-fantasy text-amber-400 mb-4">GM 玩家点评</h3>
              <div className="space-y-3">
                {data.ending_recap.gm_reviews.map((review) => (
                  <div key={review.player_id} className="p-3 rounded border border-midnight-600 bg-midnight-700/30">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-parchant-100 font-medium">{sanitizeSettlementText(review.display_name)}</span>
                      <span className="text-xs text-amber-400">贡献分 {review.score}</span>
                    </div>
                    <p className="text-sm text-parchant-300 leading-relaxed">{sanitizeSettlementText(review.gm_comment)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data?.victory_settlement && data.victory_settlement.length > 0 && (
        <div className="panel mb-8">
          <h3 className="font-fantasy text-amber-400 mb-4">胜利结算</h3>
          <div className="space-y-3">
            {data.victory_settlement.map((item) => (
              <div key={item.player_id} className="p-3 rounded border border-midnight-600 bg-midnight-700/30">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-parchant-200 font-medium">{settlementDisplayName(item)}</span>
                  <span className="text-xs text-parchant-500">状态：{lifeStatusLabel(item.life_status)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={item.faction_victory ? "text-emerald-300" : "text-parchant-500"}>
                    阵营胜利：{item.faction_victory ? "是" : "否"}
                  </div>
                  <div className={item.personal_victory ? "text-emerald-300" : "text-parchant-500"}>
                    个人胜利：{item.personal_victory ? "是" : "否"}
                  </div>
                </div>
                {item.notes.length > 0 && (
                  <p className="text-xs text-parchant-500 mt-2">{item.notes.map(sanitizeSettlementText).join("；")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.all_endings_status && data.all_endings_status.length > 0 && (
        <div className="panel mb-8">
          <h3 className="font-fantasy text-amber-400 mb-4">所有可能结局</h3>
          <div className="space-y-3">
            {data.all_endings_status.map((es) => (
              <div
                key={es.ending_id}
                className={`p-3 rounded border ${
                  es.ending_id === endingId
                    ? "border-amber-500/70 bg-amber-900/20"
                    : "border-midnight-600"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${
                    es.ending_id === endingId ? "text-amber-300" : "text-parchant-300"
                  }`}>
                    {sanitizeSettlementText(es.title)}
                    {es.ending_id === endingId && (
                      <span className="text-xs text-amber-500 ml-2">← 达成</span>
                    )}
                  </span>
                  <span className="text-xs text-parchant-500">
                    {es.conditions_met}/{es.total_conditions} 条件
                  </span>
                </div>
                <div className="w-full bg-midnight-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      es.ending_id === endingId ? "bg-amber-500" : "bg-midnight-500"
                    }`}
                    style={{ width: `${es.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center">
        <button onClick={() => router.push("/")} className="btn-primary px-8">
          返回首页
        </button>
        <button onClick={() => router.push("/generate")} className="btn-secondary px-8">
          创建新故事
        </button>
      </div>
    </div>
  );
}

function lifeStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    alive: "存活",
    dead: "死亡",
    missing: "失踪",
    imprisoned: "囚禁",
    defeated: "受挫",
    setback: "受挫",
  };
  return labels[status] || sanitizeSettlementText(status);
}

function settlementDisplayName(item: {
  player_id: string;
  player_name?: string;
  role_id: string | null;
  role_name?: string;
}): string {
  if (item.role_name) return sanitizeSettlementText(item.role_name);
  if (item.player_name) return sanitizeSettlementText(item.player_name);

  const roleNames: Record<string, string> = {
    role_1: "王子",
    role_2: "圣女",
    role_3: "刺客",
    role_4: "骑士",
  };

  if (item.role_id && roleNames[item.role_id]) return roleNames[item.role_id];
  if (item.role_id) return sanitizeSettlementText(item.role_id);
  return "未知角色";
}

function sanitizeSettlementText(text: string | undefined): string {
  let output = String(text || "");
  const replacements: Array<[RegExp, string]> = [
    [/\brole_1\b/g, "王子"],
    [/\brole_2\b/g, "圣女"],
    [/\brole_3\b/g, "刺客"],
    [/\brole_4\b/g, "骑士"],
    [/\bplayer[\s_-]?\d+\b/gi, "玩家"],
    [/\bsituation_stability\b/g, "局势稳定度"],
    [/\bpolitical_stability\b/g, "政治稳定度"],
    [/\btruth_progress\b/g, "真相进度"],
    [/\bfaction_power\b/g, "势力值"],
    [/\bsupernatural_pressure\b/g, "超自然压力"],
    [/\bsuspicion\b/g, "怀疑度"],
    [/\btrust\b/g, "信任度"],
    [/\bcurrent_location\b/g, "当前位置"],
    [/\bconnected_location\b/g, "相邻地点"],
    [/\bself_goal\b/g, "个人目标"],
    [/\ball_players\b/g, "所有玩家"],
  ];

  for (const [pattern, label] of replacements) {
    output = output.replace(pattern, label);
  }

  output = output
    .replace(/\bnpc_([a-z0-9_]+)\b/gi, "相关人物")
    .replace(/\bevt_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bevent_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bending_([a-z0-9_]+)\b/gi, "相关结局")
    .replace(/\b[a-z]+(?:_[a-z0-9]+){2,}\b/gi, "相关条目");

  return output;
}
