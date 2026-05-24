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
      if (data.provider_status?.ok === false) {
        setEnhanceMessage(`已使用本地随机故事。大模型未成功调用：${data.provider_status.reason || "未知原因"}`);
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
        // Use demo story directly
        setBible(DEMO_STORY_BIBLE);
        setValidation({ valid: true, errors: [], warnings: [] });
        setPlayability(null);
        setLoading(false);
        return;
      }

      const combinedCharacters = [
        characters ? `人物：${characters}` : "",
        characterDetails ? `人物性格和人物间关系：${characterDetails}` : "",
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_idea: [genre, opening, ending, combinedCharacters, worldSetting].filter(Boolean).join("\n"),
          genre,
          opening,
          ending,
          characters: combinedCharacters,
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
              {isLowPlayability(playability) && (
                <div className="mt-3 rounded border border-orange-500/50 bg-orange-950/30 p-3">
                  <p className="text-sm text-orange-200 mb-2">
                    低可玩性分析得分可能会影响游戏体验。你可以让 AI 先完善剧本和人设，补强人物性格、公开目标、秘密目标、人物关系和核心冲突。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleEnhanceWithAI}
                      disabled={enhancing}
                      className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                    >
                      {enhancing ? "AI 完善中..." : "由 AI 完善剧本和人设"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowLowPlayability(true);
                        setEnhanceMessage("已保留当前剧本，你可以继续创建房间或手动修改。");
                      }}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      暂不完善，继续使用
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {enhanceMessage && (
            <div className="mb-4 p-3 rounded border border-emerald-600/40 bg-emerald-900/10 text-sm text-emerald-200">
              {enhanceMessage}
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
          disabled={validation?.valid === false || (playability?.merged.playable === false && !allowLowPlayability)}
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
        <div className="rounded border border-amber-600/30 bg-amber-900/10 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-amber-300 font-medium">没有灵感？</p>
              <p className="text-xs text-parchant-500 mt-1">点击随机故事，让大模型自动生成题材、开场、结局、人物关系和世界观。</p>
            </div>
            <button
              type="button"
              onClick={handleRandomStory}
              disabled={randomizing || loading}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              {randomizing ? "随机生成中..." : "随机故事"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">题材</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例如：民宿悬疑、校园言情、搞笑、推理、权谋、恐怖"
            className="input-field"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">开场设定</label>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="写出故事开始时发生了什么。越详细，生成的剧本会越精彩。"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">结局方向</label>
          <textarea
            value={ending}
            onChange={(e) => setEnding(e.target.value)}
            placeholder="写出你希望故事最终走向哪里。越详细，生成的剧本会越精彩。"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">人物</label>
          <textarea
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="填写主要人物或玩家角色，例如：林晚、民宿老板、失踪者妹妹、前记者"
            className="input-field h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">人物性格和人物间关系（选填）</label>
          <textarea
            value={characterDetails}
            onChange={(e) => setCharacterDetails(e.target.value)}
            placeholder="可填写人物性格、隐藏关系、矛盾、旧怨、阵营关系等；不填也可以生成。"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-parchant-300 mb-1 block">世界观</label>
          <textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="描述故事发生的地点、时代、规则、氛围或特殊设定。"
            className="input-field h-24 resize-none"
          />
        </div>

        {enhanceMessage && (
          <div className="bg-emerald-900/20 border border-emerald-600/50 rounded p-3 text-sm text-emerald-300">
            {enhanceMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-600/50 rounded p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (!isDemo && !genre && !opening && !ending && !characters && !worldSetting)}
          className="btn-primary w-full py-3"
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
