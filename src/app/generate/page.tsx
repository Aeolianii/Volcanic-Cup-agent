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
        <div className="w-10 h-10 rounded-full border-2 border-amber-600/20 border-t-amber-400 animate-spin" />
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

  const [genre, setGenre] = useState("");
  const [opening, setOpening] = useState("");
  const [ending, setEnding] = useState("");
  const [characters, setCharacters] = useState("");
  const [characterDetails, setCharacterDetails] = useState("");
  const [worldSetting, setWorldSetting] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceMessage, setEnhanceMessage] = useState("");
  const [allowLowPlayability, setAllowLowPlayability] = useState(false);
  const [bible, setBible] = useState<StoryBible | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [playability, setPlayability] = useState<PlayabilityReport | null>(null);
  const [error, setError] = useState("");

  const fillStoryFields = (story: Record<string, unknown>) => {
    setGenre(typeof story.genre === "string" ? story.genre : "");
    setOpening(typeof story.opening === "string" ? story.opening : "");
    setEnding(typeof story.ending === "string" ? story.ending : "");
    setCharacters(typeof story.characters === "string" ? story.characters : "");
    setCharacterDetails(typeof story.character_details === "string" ? story.character_details : "");
    setWorldSetting(typeof story.world_setting === "string" ? story.world_setting : "");
    setBible(null);
    setValidation(null);
    setPlayability(null);
    setAllowLowPlayability(false);
  };

  const handleRandomStory = async () => {
    setRandomizing(true);
    setError("");
    setEnhanceMessage("");

    try {
      const res = await fetch("/api/stories/random", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "随机故事生成失败，请稍后重试");
        return;
      }

      fillStoryFields(data.story || {});
      if (data.provider_status?.provider === "llm_repaired") {
        setEnhanceMessage("大模型返回格式不完整，系统已自动提取可用内容并填充到文本框。");
      } else if (data.provider_status?.ok === false) {
        setEnhanceMessage(`已使用本地随机故事。原因：${data.provider_status.reason || "大模型返回格式不完整"}`);
      } else {
        setEnhanceMessage(`大模型已生成随机故事${data.story?.inspiration_title ? `《${data.story.inspiration_title}》` : ""}，并填充到文本框。`);
      }
    } catch {
      setError("随机故事请求失败，请检查网络或服务状态");
    } finally {
      setRandomizing(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setEnhanceMessage("");
    setAllowLowPlayability(false);

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
          story_idea: [genre, opening, ending, characters, characterDetails, worldSetting].filter(Boolean).join("\n"),
          genre,
          opening,
          ending,
          characters,
          character_details: characterDetails,
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

  const handleEnhanceWithAI = async () => {
    setEnhancing(true);
    setError("");
    setEnhanceMessage("");

    try {
      const res = await fetch("/api/stories/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          opening,
          ending,
          characters,
          character_details: characterDetails,
          world_setting: worldSetting,
          playability_score: playability?.merged.playable_score,
          suggested_fixes: playability?.merged.suggested_fixes || [],
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "AI 完善失败，请稍后重试");
        return;
      }

      const enhanced = data.enhanced || {};
      fillStoryFields({
        genre: enhanced.genre || genre,
        opening: enhanced.opening || opening,
        ending: enhanced.ending || ending,
        characters: enhanced.characters || characters,
        character_details: enhanced.character_details || characterDetails,
        world_setting: enhanced.world_setting || worldSetting,
      });

      if (data.provider_status?.ok === false) {
        setEnhanceMessage(`已使用本地规则完善草稿。大模型未成功调用：${data.provider_status.reason || "未知原因"}`);
      } else {
        setEnhanceMessage("AI 已完善剧本和人设，请检查后重新生成 Story Bible。");
      }
    } catch {
      setError("AI 完善请求失败，请检查网络或服务状态");
    } finally {
      setEnhancing(false);
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

  if (isDemo && !bible) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="panel-immerse text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-700/10 border border-amber-600/20 flex items-center justify-center mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
              <path d="M3 21h18M5 21V7l3-3v4l4-4 4 4V3l3 3v18" />
            </svg>
          </div>
          <h2 className="font-fantasy text-3xl text-amber-300 mb-3">失落圣杯之夜</h2>
          <p className="text-parchment-400 mb-2 text-lg">西幻 + 权谋 + 推理</p>
          <div className="flex items-center justify-center gap-4 text-xs text-parchment-600 mb-8">
            <span className="badge-amber">4 角色</span>
            <span className="badge-amber">4 结局</span>
            <span className="badge-amber">Demo</span>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary text-lg px-10 py-3">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-midnight-950/30 border-t-midnight-950 animate-spin" />
                加载中...
              </span>
            ) : "加载 Demo"}
          </button>
        </div>
      </div>
    );
  }

  if (bible) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Story Bible Summary */}
        <div className="panel-glow">
          <h2 className="font-fantasy text-2xl text-amber-300 mb-1">{bible.title}</h2>
          <p className="text-parchment-400 text-sm mb-6">{bible.world_setting.atmosphere}</p>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="glass p-4">
              <h3 className="text-xs text-amber-500/80 uppercase tracking-wider mb-3">可玩角色 ({bible.roles.length})</h3>
              <ul className="text-sm text-parchant-300 space-y-2">
                {bible.roles.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-parchant-600">&mdash; {r.public_identity}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass p-4">
              <h3 className="text-xs text-amber-500/80 uppercase tracking-wider mb-3">NPC ({bible.npcs.length})</h3>
              <ul className="text-sm text-parchant-300 space-y-2">
                {bible.npcs.map((n) => (
                  <li key={n.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                    <span className="font-medium">{n.name}</span>
                    <span className="text-parchant-600">&mdash; {n.public_identity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {bible.runtime_modules && (
            <div className="glass p-4 mb-5">
              <h3 className="text-xs text-amber-500/80 uppercase tracking-wider mb-3">玩法模块</h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge-amber text-xs">
                  {runtimeProfileLabel(bible.runtime_modules.genre_profile)}
                </span>
                <span className="badge-amber text-xs">
                  {consequenceModeLabel(bible.runtime_modules.consequence_mode)}
                </span>
                {Object.entries(bible.runtime_modules.enabled)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <span key={key} className="badge-blue text-xs">
                      {moduleLabel(key)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {playability && (
            <div className={`glass border p-4 mb-5 ${
              playability.merged.playable_score >= 60
                ? "border-emerald-600/30"
                : "border-orange-600/40"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-amber-400 font-medium">可玩性分析</h3>
                <span className={`text-lg font-bold ${
                  playability.merged.playable_score >= 60 ? "text-emerald-400" : "text-orange-400"
                }`}>
                  {playability.merged.playable_score}/100
                </span>
              </div>
              {/* Score bar */}
              <div className="w-full bg-midnight-800 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${
                    playability.merged.playable_score >= 80 ? "bg-emerald-500" :
                    playability.merged.playable_score >= 60 ? "bg-amber-500" :
                    "bg-orange-500"
                  }`}
                  style={{ width: `${playability.merged.playable_score}%` }}
                />
              </div>
              {playability.merged.design_notes.length > 0 && (
                <ul className="text-xs text-parchant-400 space-y-1 mb-3">
                  {playability.merged.design_notes.map((note, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">&#x2022;</span>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              {isLowPlayability(playability) && (
                <div className="mt-3 rounded-xl border border-orange-600/30 bg-orange-950/20 p-4">
                  <p className="text-sm text-orange-200 mb-3">
                    低可玩性可能影响游戏体验。建议让 AI 完善剧本和人设后再生成。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleEnhanceWithAI} disabled={enhancing} className="btn-primary text-sm flex-1">
                      {enhancing ? "AI 完善中..." : "由 AI 完善剧本和人设"}
                    </button>
                    <button
                      onClick={() => {
                        setAllowLowPlayability(true);
                        setEnhanceMessage("已保留当前剧本，你可以继续创建房间或手动修改。");
                      }}
                      className="btn-secondary text-sm flex-1"
                    >
                      暂不完善，继续使用
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {enhanceMessage && (
            <div className="glass border border-emerald-600/30 p-4 text-sm text-emerald-200 mb-5">
              <div className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 mt-0.5 shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                {enhanceMessage}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="glass p-4">
              <h3 className="text-xs text-amber-500/80 uppercase tracking-wider mb-3">阵营 ({bible.factions.length})</h3>
              <div className="space-y-2">
                {bible.factions.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm text-parchant-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                    {f.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="glass p-4">
              <h3 className="text-xs text-amber-500/80 uppercase tracking-wider mb-3">结局 ({bible.endings.length})</h3>
              <div className="space-y-2">
                {bible.endings.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm text-parchant-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500/40" />
                    {e.title}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {validation && (
            <div className={`rounded-xl border p-4 ${
              validation.valid
                ? "border-emerald-600/30 bg-emerald-950/10"
                : "border-rose-600/30 bg-rose-950/10"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {validation.valid ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                )}
                <span className={`text-sm font-medium ${validation.valid ? "text-emerald-400" : "text-rose-400"}`}>
                  {validation.valid ? "校验通过" : "校验未通过"}
                </span>
              </div>
              {validation.errors.length > 0 && (
                <ul className="text-xs text-rose-400 space-y-1">
                  {validation.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">&#x2022;</span>
                      <span>{e.field}: {e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={validation?.valid === false || (playability?.merged.playable === false && !allowLowPlayability)}
          className="btn-primary w-full text-lg py-4 font-fantasy tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
        >
          创建房间
        </button>
      </div>
    );
  }

  // Input form
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h2 className="font-fantasy text-2xl text-amber-400 mb-6 text-center">
        <span className="heading-ornament">创建故事</span>
      </h2>

      <div className="panel-glow space-y-5">
        {/* Random story hint */}
        <div className="rounded-xl border border-amber-600/20 bg-gradient-to-r from-amber-950/20 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-amber-300 font-medium">没有灵感？</p>
              <p className="text-xs text-parchant-500 mt-1">让大模型自动生成题材、开场、结局、人物关系和世界观。</p>
            </div>
            <button
              onClick={handleRandomStory}
              disabled={randomizing || loading}
              className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
            >
              {randomizing ? "生成中..." : "随机故事"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">题材</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例如：民宿悬疑、校园言情、搞笑、推理、权谋、恐怖"
            className="input-field"
          />
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">开场设定</label>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="写出故事开始时发生了什么。越详细，生成的剧本会越精彩。"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">结局方向</label>
          <textarea
            value={ending}
            onChange={(e) => setEnding(e.target.value)}
            placeholder="写出你希望故事最终走向哪里。越详细，生成的剧本会越精彩。"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">人物</label>
          <textarea
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="填写主要人物或玩家角色，例如：林晚、民宿老板、失踪者妹妹、前记者"
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">人物性格和关系（选填）</label>
          <textarea
            value={characterDetails}
            onChange={(e) => setCharacterDetails(e.target.value)}
            placeholder="可填写人物性格、隐藏关系、矛盾、旧怨、阵营关系等"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-parchant-400 uppercase tracking-wider mb-1.5 block">世界观</label>
          <textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="描述故事发生的地点、时代、规则、氛围或特殊设定。"
            className="input-field h-24 resize-none"
          />
        </div>

        {enhanceMessage && (
          <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/10 p-4 text-sm text-emerald-200">
            {enhanceMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-600/30 bg-rose-950/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (!isDemo && !genre && !opening && !ending && !characters && !worldSetting)}
          className="btn-primary w-full py-3.5 text-base font-medium"
        >
          {loading ? "生成中..." : "生成 Story Bible"}
        </button>
      </div>
    </div>
  );
}

function isLowPlayability(playability: PlayabilityReport): boolean {
  return playability.merged.playable === false || playability.merged.playable_score < 60;
}

function runtimeProfileLabel(profile: string): string {
  const labels: Record<string, string> = {
    campus_romance: "校园言情", romance: "恋爱", comedy: "搞笑",
    mystery: "推理", horror: "恐怖", political_intrigue: "权谋",
    combat_adventure: "战斗冒险", workplace: "职场", generic: "通用",
  };
  return labels[profile] || profile;
}

function consequenceModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    lethal: "可死亡", romance_failure: "攻略失败", comic_setback: "整活翻车",
    social_setback: "社交受挫", investigation_failure: "推理受阻",
  };
  return labels[mode] || mode;
}

function moduleLabel(key: string): string {
  const labels: Record<string, string> = {
    knowledge_fog: "信息迷雾", investigation: "调查", misinformation: "误导信息",
    factions: "阵营", private_chat: "私聊", relationship_routes: "关系线",
    combat: "战斗", character_death: "死亡", ghost_mode: "幽灵旁观",
    failure_screen: "失败界面", comic_setbacks: "搞笑挫折", gm_balancer: "GM 平衡",
    auto_simulation_after_exit: "离场推演",
  };
  return labels[key] || key;
}
