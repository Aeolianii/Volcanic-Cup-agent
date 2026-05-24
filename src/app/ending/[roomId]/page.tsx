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
    role_id: string | null;
    faction_id?: string;
    faction_victory: boolean;
    personal_victory: boolean;
    life_status: string;
    notes: string[];
  }[];
  ending_narrative: string;
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
        // Use mock data
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
      {/* Ending Title */}
      <div className="text-center mb-10">
        <h1 className="font-fantasy text-4xl text-amber-400 mb-2">
          {data?.ending?.title || "故事结束"}
        </h1>
        <p className="text-parchant-500 text-lg">
          {data?.ending?.description || "命运之线已经编织完毕..."}
        </p>
      </div>

      {/* Ending Narrative */}
      {data?.ending_narrative && (
        <div className="panel mb-8">
          <div className="prose prose-invert max-w-none text-parchant-200 leading-relaxed whitespace-pre-wrap">
            {data.ending_narrative}
          </div>
        </div>
      )}

      {data?.victory_settlement && data.victory_settlement.length > 0 && (
        <div className="panel mb-8">
          <h3 className="font-fantasy text-amber-400 mb-4">胜利结算</h3>
          <div className="space-y-3">
            {data.victory_settlement.map((item) => (
              <div key={item.player_id} className="p-3 rounded border border-midnight-600 bg-midnight-700/30">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-parchant-200 font-medium">{item.role_id || item.player_id}</span>
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
                  <p className="text-xs text-parchant-500 mt-2">{item.notes.join("；")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Endings Status */}
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
                    {es.title}
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

      {/* Actions */}
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
  };
  return labels[status] || status;
}
