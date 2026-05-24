import type { StoryBible, WorldState } from "@/types";

export function sanitizeForPlayerDisplay(
  value: string,
  bible?: Pick<StoryBible, "roles" | "npcs" | "factions" | "events" | "metrics">,
  state?: Pick<WorldState, "locations">
): string {
  let text = String(value || "");
  const labels = buildDisplayLabels(bible, state);

  for (const [id, label] of labels) {
    text = replaceToken(text, id, label);
  }

  return text
    .replace(/\bplayer_\d+\b/g, "玩家")
    .replace(/\bnpc_([a-z0-9_]+)\b/gi, "相关人物")
    .replace(/\brole_([a-z0-9_]+)\b/gi, "相关角色")
    .replace(/\bcurrent_location\b/g, "当前位置")
    .replace(/\bconnected_location\b/g, "相邻地点")
    .replace(/\bcurrent_event\b/g, "当前事件")
    .replace(/\bself_goal\b/g, "个人目标")
    .replace(/\ball_players\b/g, "所有玩家")
    .replace(/\btruth_progress\b/g, "真相进度")
    .replace(/\bsituation_stability\b/g, "局势稳定度")
    .replace(/\bfaction_power\b/g, "阵营影响力")
    .replace(/\bsuspicion\b/g, "怀疑度")
    .replace(/\brelationship_trust\b/g, "关系信任度")
    .replace(/\bAction completed:\s*/gi, "行动完成：")
    .replace(/\bfailed with ([a-z_]+) against\b/gi, "行动未完全奏效，目标：")
    .replace(/\bsucceeded with ([a-z_]+) against\b/gi, "行动奏效，目标：")
    .replace(/[_|]{2,}/g, " ")
    .trim();
}

export function sanitizeSuggestedActionText<T extends { label?: string; context?: string; target?: string; method?: string; intent?: string }>(
  action: T,
  bible?: Pick<StoryBible, "roles" | "npcs" | "factions" | "events" | "metrics">,
  state?: Pick<WorldState, "locations">
): T {
  return {
    ...action,
    label: action.label ? sanitizeForPlayerDisplay(action.label, bible, state) : action.label,
    context: action.context ? sanitizeForPlayerDisplay(action.context, bible, state) : action.context,
    target: action.target ? sanitizeForPlayerDisplay(action.target, bible, state) : action.target,
    method: action.method ? sanitizeForPlayerDisplay(action.method, bible, state) : action.method,
    intent: action.intent ? sanitizeForPlayerDisplay(action.intent, bible, state) : action.intent,
  };
}

function buildDisplayLabels(
  bible?: Pick<StoryBible, "roles" | "npcs" | "factions" | "events" | "metrics">,
  state?: Pick<WorldState, "locations">
): Map<string, string> {
  const labels = new Map<string, string>();
  bible?.roles.forEach((item) => labels.set(item.id, item.name));
  bible?.npcs.forEach((item) => labels.set(item.id, item.name));
  bible?.factions.forEach((item) => labels.set(item.id, item.name));
  bible?.events.forEach((item) => labels.set(item.id, item.title));
  bible?.metrics.forEach((item) => labels.set(item.id, item.label));
  state?.locations.forEach((item) => labels.set(item.id, item.name));
  return labels;
}

function replaceToken(text: string, token: string, label: string): string {
  return text.replace(new RegExp(escapeRegExp(token), "g"), label);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
