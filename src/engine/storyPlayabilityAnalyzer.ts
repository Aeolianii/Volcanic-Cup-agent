import type {
  StoryBible,
  StoryConsequenceMode,
  StoryGenreProfile,
  StoryRuntimeModules,
  StorySeed,
} from "@/types";
import { analyzeStory, type StoryAnalysis } from "./storyAnalyzer";

export interface LLMPlayabilityAnalysis {
  playable_score?: number;
  genre_profile?: StoryGenreProfile;
  tone_tags?: string[];
  recommended_modules?: Partial<StoryRuntimeModules["enabled"]>;
  consequence_mode?: StoryConsequenceMode;
  disabled_action_types?: string[];
  missing_elements?: string[];
  suggested_fixes?: string[];
  design_notes?: string[];
}

export interface PlayabilityReport {
  local: StoryAnalysis;
  llm: LLMPlayabilityAnalysis | null;
  merged: {
    playable: boolean;
    playable_score: number;
    missing_elements: string[];
    suggested_fixes: string[];
    design_notes: string[];
  };
}

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export async function analyzeStoryPlayability(seed: StorySeed): Promise<PlayabilityReport> {
  const local = analyzeStory(seed);
  const llm = await analyzeWithLLM(seed, local);
  const llmScore = Number.isFinite(llm?.playable_score) ? Number(llm?.playable_score) : local.playable_score;
  const score = Math.round(local.playable_score * 0.55 + llmScore * 0.45);
  const llmPlayable = Boolean(llm && llmScore >= 60);

  return {
    local,
    llm,
    merged: {
      playable: score >= 40 && (local.playable || llmPlayable),
      playable_score: Math.max(0, Math.min(100, score)),
      missing_elements: unique([
        ...local.missing_elements,
        ...(llm?.missing_elements || []),
      ]),
      suggested_fixes: unique([
        ...local.suggested_fixes,
        ...(llm?.suggested_fixes || []),
      ]),
      design_notes: unique(llm?.design_notes || []),
    },
  };
}

export function applyPlayabilityToBible(
  bible: StoryBible,
  report: PlayabilityReport
): StoryBible {
  const runtime = bible.runtime_modules;
  if (!runtime) return bible;
  if (!report.llm) {
    return {
      ...bible,
      runtime_modules: normalizeRuntimeModules(runtime),
    };
  }

  const mergedRuntime: StoryRuntimeModules = {
    ...runtime,
    genre_profile: report.llm.genre_profile || runtime.genre_profile,
    tone_tags: unique([...runtime.tone_tags, ...(report.llm.tone_tags || [])]),
    enabled: {
      ...runtime.enabled,
      ...(report.llm.recommended_modules || {}),
    },
    consequence_mode: report.llm.consequence_mode || runtime.consequence_mode,
    disabled_action_types: unique([
      ...runtime.disabled_action_types,
      ...(report.llm.disabled_action_types || []),
    ]),
  };

  return {
    ...bible,
    runtime_modules: normalizeRuntimeModules(mergedRuntime),
  };
}

async function analyzeWithLLM(
  seed: StorySeed,
  local: StoryAnalysis
): Promise<LLMPlayabilityAnalysis | null> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) return null;

  const fallback: LLMPlayabilityAnalysis = {};
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildPrompt(seed, local),
        max_tokens: 1200,
        stream: false,
        temperature: 0.35,
        response_format: { type: "json_object" },
        ...getProviderOptions(baseUrl),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return normalizeLLMAnalysis(parseJSON(content, fallback));
  } catch {
    return null;
  }
}

function normalizeRuntimeModules(runtime: StoryRuntimeModules): StoryRuntimeModules {
  const enabled = { ...runtime.enabled };
  let consequenceMode = runtime.consequence_mode;
  let disabledActionTypes = [...runtime.disabled_action_types];

  if (consequenceMode === "lethal" && !enabled.character_death) {
    consequenceMode = fallbackNonLethalConsequence(runtime.genre_profile);
  }

  if (!enabled.character_death) {
    enabled.ghost_mode = false;
    disabledActionTypes = unique([
      ...disabledActionTypes,
      "assassinate",
      "execute",
      "sacrifice",
      "ambush",
      "duel",
    ]);
  } else {
    enabled.ghost_mode = true;
  }

  return {
    ...runtime,
    enabled,
    consequence_mode: consequenceMode,
    disabled_action_types: disabledActionTypes,
  };
}

function fallbackNonLethalConsequence(profile: StoryGenreProfile): StoryConsequenceMode {
  if (profile === "campus_romance" || profile === "romance") return "romance_failure";
  if (profile === "comedy") return "comic_setback";
  if (profile === "mystery" || profile === "horror") return "investigation_failure";
  return "social_setback";
}

function buildPrompt(seed: StorySeed, local: StoryAnalysis): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是互动叙事游戏的剧本可玩性分析器。",
        "请结合用户故事创意和本地规则分析，判断这个故事适合启用哪些游戏模块。",
        "重点：不要把所有剧本都做成战斗/死亡玩法。校园言情应偏关系线和攻略失败；搞笑本应偏整活挫折，不应有严肃失败界面；恐怖/战争/暗杀本才启用死亡和幽灵旁观。",
        "必须只返回 JSON，不要 Markdown。",
        "JSON 字段：playable_score, genre_profile, tone_tags, recommended_modules, consequence_mode, disabled_action_types, missing_elements, suggested_fixes, design_notes。",
        "genre_profile 可选值：campus_romance, romance, comedy, mystery, horror, political_intrigue, combat_adventure, workplace, generic。",
        "consequence_mode 可选值：lethal, romance_failure, comic_setback, social_setback, investigation_failure。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({ seed, local_analysis: local }),
    },
  ];
}

function normalizeLLMAnalysis(value: LLMPlayabilityAnalysis): LLMPlayabilityAnalysis {
  return {
    playable_score: clampScore(value.playable_score),
    genre_profile: normalizeGenre(value.genre_profile),
    tone_tags: arrayOfStrings(value.tone_tags),
    recommended_modules: normalizeModules(value.recommended_modules),
    consequence_mode: normalizeConsequence(value.consequence_mode),
    disabled_action_types: arrayOfStrings(value.disabled_action_types).filter(isKnownActionType),
    missing_elements: arrayOfStrings(value.missing_elements),
    suggested_fixes: arrayOfStrings(value.suggested_fixes),
    design_notes: arrayOfStrings(value.design_notes),
  };
}

function normalizeModules(value: unknown): Partial<StoryRuntimeModules["enabled"]> {
  if (!value || typeof value !== "object") return {};
  const allowed = new Set([
    "knowledge_fog",
    "investigation",
    "misinformation",
    "factions",
    "private_chat",
    "relationship_routes",
    "combat",
    "character_death",
    "ghost_mode",
    "failure_screen",
    "comic_setbacks",
    "gm_balancer",
    "auto_simulation_after_exit",
  ]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => allowed.has(key) && typeof item === "boolean")
  ) as Partial<StoryRuntimeModules["enabled"]>;
}

function normalizeGenre(value: unknown): StoryGenreProfile | undefined {
  const allowed: StoryGenreProfile[] = [
    "campus_romance",
    "romance",
    "comedy",
    "mystery",
    "horror",
    "political_intrigue",
    "combat_adventure",
    "workplace",
    "generic",
  ];
  return allowed.includes(value as StoryGenreProfile) ? value as StoryGenreProfile : undefined;
}

function normalizeConsequence(value: unknown): StoryConsequenceMode | undefined {
  const allowed: StoryConsequenceMode[] = [
    "lethal",
    "romance_failure",
    "comic_setback",
    "social_setback",
    "investigation_failure",
  ];
  return allowed.includes(value as StoryConsequenceMode) ? value as StoryConsequenceMode : undefined;
}

function parseJSON<T>(content: string, fallback: T): T {
  const raw = content.trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace
    ? raw.slice(firstBrace, lastBrace + 1)
    : raw;
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return fallback;
  }
}

function getConfig() {
  return {
    apiKey:
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_COMPAT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseUrl:
      process.env.DEEPSEEK_BASE_URL ||
      process.env.OPENAI_COMPAT_BASE_URL ||
      "https://api.deepseek.com",
    model:
      process.env.DEEPSEEK_MODEL ||
      process.env.OPENAI_COMPAT_MODEL ||
      "deepseek-v4-pro",
  };
}

function getProviderOptions(baseUrl: string): Record<string, unknown> {
  const disablesDeepSeekThinking =
    /deepseek/i.test(baseUrl) && process.env.DEEPSEEK_THINKING !== "enabled";

  return disablesDeepSeekThinking ? { thinking: { type: "disabled" } } : {};
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function clampScore(value: unknown): number | undefined {
  const score = Number(value);
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isKnownActionType(value: string): boolean {
  return [
    "talk",
    "persuade",
    "threaten",
    "deceive",
    "ally",
    "betray",
    "confess",
    "investigate",
    "search",
    "track",
    "eavesdrop",
    "interrogate",
    "decode",
    "spy",
    "divination",
    "gather_intelligence",
    "command",
    "summon_meeting",
    "gain_support",
    "coup",
    "impeach",
    "appoint",
    "attack",
    "assassinate",
    "duel",
    "ambush",
    "defend",
    "execute",
    "sacrifice",
    "buy",
    "trade",
    "steal",
    "transport",
    "build",
  ].includes(value);
}
