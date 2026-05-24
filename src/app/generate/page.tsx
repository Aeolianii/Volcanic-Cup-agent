"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_STORY_BIBLE } from "@/mock/demoStoryBible";
import type { StoryBible } from "@/types";
import type { ValidationResult } from "@/engine/storyBibleValidator";
import type { PlayabilityReport } from "@/engine/storyPlayabilityAnalyzer";

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="panel text-center">加载中...</div>}>
      <GeneratePageContent />
    </Suspense>
  );
}

function GeneratePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [storyIdea, setStoryIdea] = useState("");
  const [genre, setGenre] = useState("");
  const [opening, setOpening] = useState("");
  const [ending, setEnding] = useState("");
  const [characters, setCharacters] = useState("");
  const [worldSetting, setWorldSetting] = useState("");
  const [loading, setLoading] = useState(false);
  const [bible, setBible] = useState<StoryBible | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [playability, setPlayability] = useState<PlayabilityReport | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      if (isDemo) {
        // Use demo story directly
        setBible(DEMO_STORY_BIBLE);
        setValidation({ valid: true, errors: [], warnings: [] });
        setPlayability(null);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_idea: storyIdea,
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
        setPlayability(data.playability || null);
      } else {
        setError(data.error || "生成失败");
        setBible(data.story_bible || null);
        setValidation(data.validation || null);
        setPlayability(data.playability || null);
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

          {bible.runtime_modules && (
            <div className="mb-4 p-3 rounded border border-midnight-600 bg-midnight-700/30">
              <h3 className="text-sm text-amber-500 mb-2">玩法模块</h3>
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="bg-midnight-600 px-2 py-1 rounded text-parchant-300">
                  类型：{runtimeProfileLabel(bible.runtime_modules.genre_profile)}
                </span>
                <span className="bg-midnight-600 px-2 py-1 rounded text-parchant-300">
                  后果：{consequenceModeLabel(bible.runtime_modules.consequence_mode)}
                </span>
                {Object.entries(bible.runtime_modules.enabled)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <span key={key} className="bg-midnight-600 px-2 py-1 rounded text-parchant-300">
                      {moduleLabel(key)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {playability && (
            <div className="mb-4 p-3 rounded border border-amber-600/40 bg-amber-900/10">
              <h3 className="text-sm text-amber-400 mb-1">可玩性分析：{playability.merged.playable_score}/100</h3>
              {playability.merged.design_notes.length > 0 && (
                <ul className="text-xs text-parchant-400 list-disc list-inside mb-2">
                  {playability.merged.design_notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              )}
              {playability.merged.suggested_fixes.length > 0 && (
                <p className="text-xs text-parchant-500">
                  建议：{playability.merged.suggested_fixes.slice(0, 3).join("；")}
                </p>
              )}
            </div>
          )}

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

        <button
          onClick={handleCreateRoom}
          disabled={validation?.valid === false || playability?.merged.playable === false}
          className="btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
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
          <label className="text-sm text-parchant-300 mb-1 block">故事创意</label>
          <textarea
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
            placeholder="可以直接写一整段创意，例如：校园言情、搞笑整活、推理悬疑、权谋阵营等。AI 会结合本地规则分析可玩性并自动选择模块。"
            className="input-field h-28 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">题材</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="可选，例如：校园言情、搞笑、推理、权谋"
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
          disabled={loading || (!isDemo && !storyIdea && !genre && !opening && !worldSetting)}
          className="btn-primary w-full py-3"
        >
          {loading ? "生成中..." : "生成 Story Bible"}
        </button>
      </div>
    </div>
  );
}

function runtimeProfileLabel(profile: string): string {
  const labels: Record<string, string> = {
    campus_romance: "校园言情",
    romance: "恋爱",
    comedy: "搞笑",
    mystery: "推理",
    horror: "恐怖",
    political_intrigue: "权谋",
    combat_adventure: "战斗冒险",
    workplace: "职场",
    generic: "通用",
  };
  return labels[profile] || profile;
}

function consequenceModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    lethal: "可死亡",
    romance_failure: "攻略失败",
    comic_setback: "整活翻车",
    social_setback: "社交受挫",
    investigation_failure: "推理受阻",
  };
  return labels[mode] || mode;
}

function moduleLabel(key: string): string {
  const labels: Record<string, string> = {
    knowledge_fog: "信息迷雾",
    investigation: "调查",
    misinformation: "误导信息",
    factions: "阵营",
    private_chat: "私聊",
    relationship_routes: "关系线",
    combat: "战斗",
    character_death: "死亡",
    ghost_mode: "幽灵旁观",
    failure_screen: "失败界面",
    comic_setbacks: "搞笑挫折",
    gm_balancer: "GM 平衡",
    auto_simulation_after_exit: "离场推演",
  };
  return labels[key] || key;
}
