"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_STORY_BIBLE } from "@/mock/demoStoryBible";
import type { StoryBible } from "@/types";
import type { ValidationResult } from "@/engine/storyBibleValidator";
import type { PlayabilityReport } from "@/engine/storyPlayabilityAnalyzer";

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          <p className="text-parchment-500">加载中...</p>
        </div>
      </div>
    }>
      <GeneratePageContent />
    </Suspense>
  );
}

function GeneratePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [storyIdea, setStoryIdea] = useState("");
  const [fullScriptText, setFullScriptText] = useState("");
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
          full_script_text: fullScriptText,
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
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="panel text-center py-16 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent rounded-full" />
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center text-3xl">
            🏰
          </div>
          <h2 className="font-fantasy text-2xl text-amber-400 mb-3">失落圣杯之夜</h2>
          <p className="text-parchment-400 mb-2">西幻 + 权谋 + 推理</p>
          <p className="text-parchment-500 text-sm mb-8">4 角色 · 4 结局</p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary text-lg px-10">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-midnight-900/30 border-t-midnight-900 animate-spin" />
                加载中...
              </span>
            ) : (
              "加载 Demo"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (bible) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Story Bible Summary */}
        <div className="panel relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent rounded-full" />
          <h2 className="font-fantasy text-2xl text-amber-400 mb-3">{bible.title}</h2>
          <p className="text-parchment-400 mb-6 leading-relaxed">{bible.world_setting.atmosphere}</p>

          {/* Roles & NPCs */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="p-4 rounded-xl bg-midnight-700/30 border border-midnight-600/30">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>🎭</span> 角色 ({bible.roles.length})
              </h3>
              <ul className="text-sm text-parchment-300 space-y-2">
                {bible.roles.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <div>
                      <span className="text-parchment-200 font-medium">{r.name}</span>
                      <span className="text-parchment-500 text-xs ml-2">{r.public_identity}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-midnight-700/30 border border-midnight-600/30">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>👥</span> NPC ({bible.npcs.length})
              </h3>
              <ul className="text-sm text-parchment-300 space-y-2">
                {bible.npcs.map((n) => (
                  <li key={n.id} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <div>
                      <span className="text-parchment-200 font-medium">{n.name}</span>
                      <span className="text-parchment-500 text-xs ml-2">{n.public_identity}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Runtime Modules */}
          {bible.runtime_modules && (
            <div className="mb-5 p-4 rounded-xl border border-midnight-600/40 bg-midnight-700/20">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>⚙️</span> 玩法模块
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-amber-500/10 text-amber-300 px-2.5 py-1.5 rounded-full border border-amber-500/20">
                  类型：{runtimeProfileLabel(bible.runtime_modules.genre_profile)}
                </span>
                <span className="bg-amber-500/10 text-amber-300 px-2.5 py-1.5 rounded-full border border-amber-500/20">
                  后果：{consequenceModeLabel(bible.runtime_modules.consequence_mode)}
                </span>
                {Object.entries(bible.runtime_modules.enabled)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <span key={key} className="bg-midnight-600/60 text-parchment-300 px-2.5 py-1.5 rounded-full border border-midnight-500/40">
                      {moduleLabel(key)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Playability */}
          {playability && (
            <div className="mb-5 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>📊</span> 可玩性分析
                <span className={`text-lg font-bold ml-auto ${
                  playability.merged.playable_score >= 70 ? "text-emerald-400" :
                  playability.merged.playable_score >= 40 ? "text-amber-400" : "text-red-400"
                }`}>
                  {playability.merged.playable_score}/100
                </span>
              </h3>
              {playability.merged.design_notes.length > 0 && (
                <ul className="text-xs text-parchment-400 space-y-1 mb-3">
                  {playability.merged.design_notes.map((note, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <span className="text-amber-600 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              {playability.merged.suggested_fixes.length > 0 && (
                <p className="text-xs text-parchment-500 border-t border-amber-500/10 pt-2">
                  建议：{playability.merged.suggested_fixes.slice(0, 3).join("；")}
                </p>
              )}
            </div>
          )}

          {/* Factions & Endings */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="p-4 rounded-xl bg-midnight-700/30 border border-midnight-600/30">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>🏰</span> 阵营
              </h3>
              <ul className="text-sm text-parchment-300 space-y-1.5">
                {bible.factions.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-midnight-700/30 border border-midnight-600/30">
              <h3 className="text-sm text-amber-400 font-fantasy mb-3 flex items-center gap-2">
                <span>🎬</span> 结局
              </h3>
              <ul className="text-sm text-parchment-300 space-y-1.5">
                {bible.endings.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {e.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Validation */}
          {validation && (
            <div className={`p-4 rounded-xl border ${
              validation.valid
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                {validation.valid ? (
                  <span className="text-emerald-400">✅ 校验通过</span>
                ) : (
                  <span className="text-red-400">❌ 校验未通过</span>
                )}
              </h4>
              {validation.errors.length > 0 && (
                <ul className="text-xs text-red-400 space-y-1">
                  {validation.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="shrink-0">•</span>
                      <span className="font-mono text-red-500/70">{e.field}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={validation?.valid === false || playability?.merged.playable === false}
          className="btn-primary w-full py-3.5 text-lg font-fantasy tracking-wider"
        >
          创建房间
        </button>
      </div>
    );
  }

  // Input form
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="font-fantasy text-2xl text-amber-400 mb-2">创建故事</h2>
        <p className="text-parchment-500 text-sm">填写故事设定，AI 将为你生成完整的 Story Bible</p>
      </div>

      <div className="panel space-y-5">
        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block font-medium">完整剧本杀文本</label>
          <textarea
            value={fullScriptText}
            onChange={(e) => setFullScriptText(e.target.value)}
            placeholder="可直接粘贴完整剧本杀文本：基础信息、世界观、人物人设、人物羁绊、主持人开场、开本流程、群像结局、核心真相等。系统会识别并转成可执行 Story Bible。"
            className="input-field h-44 resize-y"
          />
        </div>

        <div className="border-t border-midnight-600/30 pt-1" />

        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block font-medium">故事创意</label>
          <textarea
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
            placeholder="可以直接写一整段创意，例如：校园言情、搞笑整活、推理悬疑、权谋阵营等。AI 会结合本地规则分析可玩性并自动选择模块。"
            className="input-field h-28 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-parchment-300 mb-1.5 block font-medium">题材</label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="校园言情、推理、权谋..."
              className="input-field"
            />
          </div>
          <div>
            <label className="text-sm text-parchment-300 mb-1.5 block font-medium">角色（逗号分隔）</label>
            <input
              type="text"
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
              placeholder="王子, 圣女, 刺客, 骑士"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block font-medium">开场设定</label>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="描述故事的开场..."
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block font-medium">结局方向</label>
          <textarea
            value={ending}
            onChange={(e) => setEnding(e.target.value)}
            placeholder="你希望的结局方向..."
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchment-300 mb-1.5 block font-medium">世界观设定</label>
          <textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="描述故事的世界观..."
            className="input-field h-20 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 animate-fade-in">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (!isDemo && !fullScriptText && !storyIdea && !genre && !opening && !worldSetting)}
          className="btn-primary w-full py-3.5 text-lg font-fantasy tracking-wider"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-midnight-900/30 border-t-midnight-900 animate-spin" />
              生成中...
            </span>
          ) : (
            "生成 Story Bible"
          )}
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
