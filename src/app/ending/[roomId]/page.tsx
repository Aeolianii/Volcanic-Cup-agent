"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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
        // Keep the ending page usable even if recap fetch fails.
      } finally {
        setLoading(false);
      }
    };

    fetchEnding();
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-lg text-parchment-500">计算结局中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">ending recap</p>
        <h1 className="section-title mb-3 text-4xl">{data?.ending?.title || "故事结束"}</h1>
        <p className="mx-auto max-w-2xl text-lg leading-8 text-parchment-400">
          {data?.ending?.description || "命运之线已经编织完毕..."}
        </p>
      </header>

      {data?.ending_narrative && (
        <section className="panel">
          <div className="whitespace-pre-wrap text-sm leading-7 text-parchment-200 md:text-base">
            {sanitizeSettlementText(data.ending_narrative)}
          </div>
        </section>
      )}

      {data?.ending_recap && (
        <section className="space-y-6">
          {data.ending_recap.mvp && (
            <div className="panel border-amber-500/60 bg-amber-500/10">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-amber-300">MVP</p>
              <h2 className="section-title mb-2 text-2xl">
                {sanitizeSettlementText(data.ending_recap.mvp.display_name)}
              </h2>
              <p className="text-sm text-parchment-300">贡献分：{data.ending_recap.mvp.score}</p>
              <p className="mt-3 leading-7 text-parchment-200">
                {sanitizeSettlementText(data.ending_recap.mvp.gm_comment)}
              </p>
            </div>
          )}

          {data.ending_recap.truth.length > 0 && (
            <RecapSection title="事件真相公开">
              {data.ending_recap.truth.map((item, index) => (
                <div key={`${item.title}_${index}`} className="border-l-2 border-amber-500/50 pl-3">
                  <p className="font-medium text-parchment-100">{sanitizeSettlementText(item.title)}</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-parchment-400">
                    {sanitizeSettlementText(item.content)}
                  </p>
                </div>
              ))}
            </RecapSection>
          )}

          {data.ending_recap.chronicle.length > 0 && (
            <RecapSection title="事件编年史">
              {data.ending_recap.chronicle.map((item, index) => (
                <div key={`${item.title}_${index}`} className="rounded border border-midnight-500/70 bg-midnight-900/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-amber-300">第 {item.turn} 回合</span>
                    <span className="font-medium text-parchment-100">{sanitizeSettlementText(item.title)}</span>
                  </div>
                  <p className="text-sm leading-7 text-parchment-400">{sanitizeSettlementText(item.description)}</p>
                </div>
              ))}
            </RecapSection>
          )}

          {data.ending_recap.player_actions.length > 0 && (
            <RecapSection title="所有玩家操作公开">
              {data.ending_recap.player_actions.map((action) => (
                <div key={action.id} className="rounded border border-midnight-500/70 bg-midnight-900/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-parchment-100">
                      第 {action.turn} 回合 · {sanitizeSettlementText(action.actor_display_name)}
                    </span>
                    <span className={action.success ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
                      {action.success ? "成功" : "失败"} · {sanitizeSettlementText(action.action_label)}
                    </span>
                  </div>
                  <p className="text-sm text-parchment-400">
                    目标：{sanitizeSettlementText(action.target_display_name || "未知")}；意图：{sanitizeSettlementText(action.intent)}
                  </p>
                  <p className="mt-1 text-sm text-parchment-300">{sanitizeSettlementText(action.public_result)}</p>
                  {action.raw_input && (
                    <p className="mt-1 text-xs text-parchment-500">原始输入：{sanitizeSettlementText(action.raw_input)}</p>
                  )}
                </div>
              ))}
            </RecapSection>
          )}

          {data.ending_recap.gm_reviews.length > 0 && (
            <RecapSection title="GM 玩家点评">
              {data.ending_recap.gm_reviews.map((review) => (
                <div key={review.player_id} className="rounded border border-midnight-500/70 bg-midnight-900/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium text-parchment-100">{sanitizeSettlementText(review.display_name)}</span>
                    <span className="text-xs text-amber-300">贡献分 {review.score}</span>
                  </div>
                  <p className="text-sm leading-7 text-parchment-300">{sanitizeSettlementText(review.gm_comment)}</p>
                </div>
              ))}
            </RecapSection>
          )}
        </section>
      )}

      {data?.victory_settlement && data.victory_settlement.length > 0 && (
        <RecapSection title="胜利结算">
          {data.victory_settlement.map((item) => (
            <div key={item.player_id} className="rounded border border-midnight-500/70 bg-midnight-900/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium text-parchment-100">{settlementDisplayName(item)}</span>
                <span className="text-xs text-parchment-500">状态：{lifeStatusLabel(item.life_status)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={item.faction_victory ? "text-emerald-300" : "text-parchment-500"}>
                  阵营胜利：{item.faction_victory ? "是" : "否"}
                </div>
                <div className={item.personal_victory ? "text-emerald-300" : "text-parchment-500"}>
                  个人胜利：{item.personal_victory ? "是" : "否"}
                </div>
              </div>
              {item.notes.length > 0 && (
                <p className="mt-2 text-xs text-parchment-500">{item.notes.map(sanitizeSettlementText).join("；")}</p>
              )}
            </div>
          ))}
        </RecapSection>
      )}

      {data?.all_endings_status && data.all_endings_status.length > 0 && (
        <RecapSection title="所有可能结局">
          {data.all_endings_status.map((status) => (
            <div
              key={status.ending_id}
              className={`rounded border p-3 ${
                status.ending_id === endingId ? "border-amber-500/70 bg-amber-500/10" : "border-midnight-500/70 bg-midnight-900/20"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className={`font-medium ${status.ending_id === endingId ? "text-amber-200" : "text-parchment-300"}`}>
                  {sanitizeSettlementText(status.title)}
                  {status.ending_id === endingId && <span className="ml-2 text-xs text-amber-300">已达成</span>}
                </span>
                <span className="text-xs text-parchment-500">
                  {status.conditions_met}/{status.total_conditions} 条件
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-midnight-700">
                <div
                  className={`h-2 rounded-full transition-all ${status.ending_id === endingId ? "bg-amber-500" : "bg-midnight-500"}`}
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          ))}
        </RecapSection>
      )}

      <div className="flex justify-center gap-4">
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

function RecapSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2 className="section-title mb-4 text-xl">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
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

  return output
    .replace(/\bnpc_([a-z0-9_]+)\b/gi, "相关人物")
    .replace(/\bevt_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bevent_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bending_([a-z0-9_]+)\b/gi, "相关结局")
    .replace(/\b[a-z]+(?:_[a-z0-9]+){2,}\b/gi, "相关条目");
}
