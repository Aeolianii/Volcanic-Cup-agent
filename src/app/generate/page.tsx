"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_STORY_BIBLE } from "@/mock/demoStoryBible";
import type { StoryBible, ValidationResult } from "@/types";

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [genre, setGenre] = useState("西幻");
  const [opening, setOpening] = useState("");
  const [ending, setEnding] = useState("");
  const [characters, setCharacters] = useState("");
  const [worldSetting, setWorldSetting] = useState("");
  const [loading, setLoading] = useState(false);
  const [bible, setBible] = useState<StoryBible | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      if (isDemo) {
        // Use demo story directly
        setBible(DEMO_STORY_BIBLE);
        setValidation({ valid: true, errors: [], warnings: [] });
        setLoading(false);
        return;
      }

      const res = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          opening,
          ending,
          characters,
          world_setting: worldSetting,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBible(data.story_bible);
        setValidation(data.validation);
      } else {
        setError(data.error || "生成失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!bible) return;

    const playerId = localStorage.getItem("player_id") || `player_${Date.now()}`;
    const playerName = localStorage.getItem("player_name") || "冒险者";
    localStorage.setItem("player_id", playerId);
    localStorage.setItem("player_name", playerName);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_bible_id: bible.id,
          player_id: playerId,
          player_name: playerName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/room/${data.room.room_id}`);
      }
    } catch {
      setError("创建房间失败");
    }
  };

  // Pre-fill demo
  if (isDemo && !bible) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="panel text-center py-12">
          <h2 className="font-fantasy text-2xl text-amber-400 mb-4">失落圣杯之夜</h2>
          <p className="text-parchant-400 mb-6">
            西幻 + 权谋 + 推理 · 4 角色 · 4 结局
          </p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary text-lg px-8">
            {loading ? "加载中..." : "加载 Demo"}
          </button>
        </div>
      </div>
    );
  }

  if (bible) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Story Bible Summary */}
        <div className="panel">
          <h2 className="font-fantasy text-2xl text-amber-400 mb-4">{bible.title}</h2>
          <p className="text-parchant-400 mb-4">{bible.world_setting.atmosphere}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-sm text-amber-500 mb-2">角色 ({bible.roles.length})</h3>
              <ul className="text-sm text-parchant-300 space-y-1">
                {bible.roles.map((r) => (
                  <li key={r.id}>• {r.name} — {r.public_identity}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm text-amber-500 mb-2">NPC ({bible.npcs.length})</h3>
              <ul className="text-sm text-parchant-300 space-y-1">
                {bible.npcs.map((n) => (
                  <li key={n.id}>• {n.name} — {n.public_identity}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-sm text-amber-500 mb-2">阵营</h3>
              <ul className="text-sm text-parchant-300">
                {bible.factions.map((f) => (
                  <li key={f.id}>• {f.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm text-amber-500 mb-2">结局</h3>
              <ul className="text-sm text-parchant-300">
                {bible.endings.map((e) => (
                  <li key={e.id}>• {e.title}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Validation */}
          {validation && (
            <div className={`p-3 rounded border ${validation.valid ? "border-green-600/50 bg-green-900/10" : "border-red-600/50 bg-red-900/10"}`}>
              <h4 className="text-sm font-medium mb-1">
                {validation.valid ? "✅ 校验通过" : "❌ 校验未通过"}
              </h4>
              {validation.errors.length > 0 && (
                <ul className="text-xs text-red-400 list-disc list-inside">
                  {validation.errors.map((e, i) => (
                    <li key={i}>{e.field}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button onClick={handleCreateRoom} className="btn-primary w-full text-lg py-3">
          创建房间
        </button>
      </div>
    );
  }

  // Input form
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-fantasy text-2xl text-amber-400 mb-6 text-center">创建故事</h2>

      <div className="panel space-y-4">
        <div>
          <label className="text-sm text-parchant-300 mb-1 block">题材</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例如：西幻、科幻、武侠"
            className="input-field"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">开场设定</label>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="描述故事的开场..."
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">结局方向</label>
          <textarea
            value={ending}
            onChange={(e) => setEnding(e.target.value)}
            placeholder="你希望的结局方向..."
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">角色（逗号分隔）</label>
          <input
            type="text"
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="王子, 圣女, 刺客, 骑士"
            className="input-field"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">世界观设定</label>
          <textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="描述故事的世界观..."
            className="input-field h-20 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-600/50 rounded p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (!isDemo && !genre)}
          className="btn-primary w-full py-3"
        >
          {loading ? "生成中..." : "生成 Story Bible"}
        </button>
      </div>
    </div>
  );
}
