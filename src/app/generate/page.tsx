"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_STORY_BIBLE } from "@/mock/demoStoryBible";
import type { StoryBible } from "@/types";
import type { ValidationResult } from "@/engine/storyBibleValidator";
import type { PlayabilityReport } from "@/engine/storyPlayabilityAnalyzer";

type StoryDraft = {
  genre?: string;
  opening?: string;
  ending?: string;
  characters?: string;
  character_details?: string;
  world_setting?: string;
  inspiration_title?: string;
};

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

  const fillStoryFields = (story: StoryDraft) => {
    setGenre(story.genre || "");
    setOpening(story.opening || "");
    setEnding(story.ending || "");
    setCharacters(story.characters || "");
    setCharacterDetails(story.character_details || "");
    setWorldSetting(story.world_setting || "");
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
        setEnhanceMessage("大模型返回格式不完整，系统已自动提取可用内容并填入表单。");
      } else if (data.provider_status?.ok === false) {
        setEnhanceMessage(`已使用本地随机故事。原因：${data.provider_status.reason || "大模型返回格式不完整"}`);
      } else {
        const title = data.story?.inspiration_title ? `《${data.story.inspiration_title}》` : "";
        setEnhanceMessage(`大模型已生成随机故事${title}，并填充到表单。`);
      }
    } catch {
      setError("随机故事请求失败，请检查网络或服务状态。");
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
      setError("网络错误，请重试。");
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
      setError("AI 完善请求失败，请检查网络或服务状态。");
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
      setError("创建房间失败。");
    }
  };

  if (isDemo && !bible) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="panel px-6 py-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">demo story</p>
          <h2 className="section-title mb-4 text-3xl">失落圣杯之夜</h2>
          <p className="mb-6 text-parchment-400">西幻 + 权谋 + 推理 · 4 个角色 · 多重结局</p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary px-8 text-lg">
            {loading ? "加载中..." : "加载 Demo"}
          </button>
        </div>
      </div>
    );
  }

  if (bible) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="panel p-5 md:p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">story bible ready</p>
          <h2 className="section-title mb-4 text-3xl">{bible.title}</h2>
          <p className="mb-5 max-w-3xl text-sm leading-7 text-parchment-300">{bible.world_setting.atmosphere}</p>

          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryBlock title={`角色 (${bible.roles.length})`}>
              {bible.roles.map((role) => (
                <li key={role.id}>{role.name} · {role.public_identity}</li>
              ))}
            </SummaryBlock>
            <SummaryBlock title={`NPC (${bible.npcs.length})`}>
              {bible.npcs.map((npc) => (
                <li key={npc.id}>{npc.name} · {npc.public_identity}</li>
              ))}
            </SummaryBlock>
          </div>

          {bible.runtime_modules && (
            <div className="mb-5 rounded border border-midnight-500/70 bg-midnight-900/35 p-3">
              <h3 className="mb-2 text-sm font-medium text-amber-300">玩法模块</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill>类型：{runtimeProfileLabel(bible.runtime_modules.genre_profile)}</Pill>
                <Pill>后果：{consequenceModeLabel(bible.runtime_modules.consequence_mode)}</Pill>
                {Object.entries(bible.runtime_modules.enabled)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <Pill key={key}>{moduleLabel(key)}</Pill>
                  ))}
              </div>
            </div>
          )}

          {playability && (
            <div className="mb-5 rounded border border-amber-500/40 bg-amber-500/10 p-3">
              <h3 className="mb-1 text-sm font-medium text-amber-300">
                可玩性分析：{playability.merged.playable_score}/100
              </h3>
              {playability.merged.design_notes.length > 0 && (
                <ul className="mb-2 list-inside list-disc text-xs text-parchment-400">
                  {playability.merged.design_notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              )}
              {playability.merged.suggested_fixes.length > 0 && (
                <p className="text-xs text-parchment-500">
                  建议：{playability.merged.suggested_fixes.slice(0, 3).join("；")}
                </p>
              )}
              {isLowPlayability(playability) && (
                <div className="mt-3 rounded border border-orange-500/50 bg-orange-950/30 p-3">
                  <p className="mb-3 text-sm leading-6 text-orange-100">
                    当前剧本可玩性偏低，可能影响游戏体验。可以让 AI 先完善人物目标、关系和核心冲突。
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleEnhanceWithAI}
                      disabled={enhancing}
                      className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {enhancing ? "AI 完善中..." : "用 AI 完善剧本和人设"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowLowPlayability(true);
                        setEnhanceMessage("已保留当前剧本，你可以继续创建房间或手动修改。");
                      }}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      暂不完善，继续使用
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {enhanceMessage && <Notice tone="success">{enhanceMessage}</Notice>}

          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryBlock title="阵营">
              {bible.factions.map((faction) => (
                <li key={faction.id}>{faction.name}</li>
              ))}
            </SummaryBlock>
            <SummaryBlock title="结局">
              {bible.endings.map((endingItem) => (
                <li key={endingItem.id}>{endingItem.title}</li>
              ))}
            </SummaryBlock>
          </div>

          {validation && (
            <div
              className={`rounded border p-3 ${
                validation.valid ? "border-green-500/50 bg-green-900/10" : "border-red-500/50 bg-red-900/10"
              }`}
            >
              <h4 className="mb-1 text-sm font-medium">
                {validation.valid ? "校验通过" : "校验未通过"}
              </h4>
              {validation.errors.length > 0 && (
                <ul className="list-inside list-disc text-xs text-red-300">
                  {validation.errors.map((item, index) => (
                    <li key={index}>{item.field}: {item.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button
          onClick={handleCreateRoom}
          disabled={validation?.valid === false || (playability?.merged.playable === false && !allowLowPlayability)}
          className="btn-primary w-full py-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          创建房间
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">story setup</p>
        <h2 className="section-title text-3xl">创建故事</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-parchment-400">
          先给 AI 一组清晰的叙事坐标，后面生成的角色、线索和结局会更稳定。
        </p>
      </div>

      <div className="panel space-y-5 p-5 md:p-6">
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-200">没有灵感？</p>
              <p className="mt-1 text-xs leading-5 text-parchment-400">
                点击随机故事，让大模型自动生成题材、开场、结局、人物关系和世界观。
              </p>
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
          <label className="field-label">题材</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例如：民宿悬疑、校园言情、搞笑、推理、权谋、恐怖"
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">开场设定</label>
            <textarea
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="故事开始时发生了什么？越具体，生成的剧本越稳定。"
              className="input-field h-28 resize-none"
            />
          </div>
          <div>
            <label className="field-label">结局方向</label>
            <textarea
              value={ending}
              onChange={(e) => setEnding(e.target.value)}
              placeholder="你希望故事最终走向哪里？可以写真相、胜负或情感结局。"
              className="input-field h-28 resize-none"
            />
          </div>
        </div>

        <div>
          <label className="field-label">人物</label>
          <textarea
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="填写主要人物或玩家角色，例如：林晚、民宿老板、失踪者妹妹、前记者"
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="field-label">人物性格和人物间关系（选填）</label>
          <textarea
            value={characterDetails}
            onChange={(e) => setCharacterDetails(e.target.value)}
            placeholder="可填写人物性格、隐藏关系、矛盾、旧怨、阵营关系等；不填也可以生成。"
            className="input-field h-28 resize-none"
          />
        </div>

        <div>
          <label className="field-label">世界观</label>
          <textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="描述故事发生的地点、时代、规则、氛围或特殊设定。"
            className="input-field h-28 resize-none"
          />
        </div>

        {enhanceMessage && <Notice tone="success">{enhanceMessage}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

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

function Notice({ children, tone }: { children: React.ReactNode; tone: "success" | "error" }) {
  const styles =
    tone === "success"
      ? "border-emerald-500/50 bg-emerald-900/20 text-emerald-200"
      : "border-red-500/50 bg-red-900/20 text-red-300";
  return <div className={`rounded border p-3 text-sm ${styles}`}>{children}</div>;
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-midnight-500/70 bg-midnight-900/25 p-3">
      <h3 className="mb-2 text-sm font-medium text-amber-300">{title}</h3>
      <ul className="space-y-1 text-sm text-parchment-300">{children}</ul>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-midnight-500/70 bg-midnight-700/70 px-2 py-1 text-parchment-300">
      {children}
    </span>
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
