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
