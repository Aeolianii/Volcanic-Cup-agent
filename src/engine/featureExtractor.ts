import type { StoryBible } from "@/types";

export interface StoryFeatures {
  has_conflict: boolean;
  has_mystery: boolean;
  has_factions: boolean;
  has_relationships: boolean;
  has_survival_pressure: boolean;
  has_resource_competition: boolean;
}

export function extractFeatures(bible: StoryBible): StoryFeatures {
  return {
    has_conflict: bible.factions.length >= 2 || hasConflictingGoals(bible),
    has_mystery: hasMysteryElements(bible),
    has_factions: bible.factions.length > 0,
    has_relationships: bible.npcs.length > 0 || bible.roles.length > 2,
    has_survival_pressure: hasSurvivalMetrics(bible),
    has_resource_competition: hasResourceMetrics(bible),
  };
}

function hasConflictingGoals(bible: StoryBible): boolean {
  const allCharacters = [...bible.roles, ...bible.npcs];
  const goals = allCharacters.map((c) => c.public_goal).filter(Boolean);
  // Simplified: if there are goals, assume potential conflict
  return goals.length >= 2;
}

function hasMysteryElements(bible: StoryBible): boolean {
  // Check for hidden events, clues, secret goals
  const hasHiddenEvents = bible.events.some((e) => e.visibility === "hidden" || e.visibility === "conditional");
  const hasSecrets = bible.npcs.some((n) => n.secret_goal) || bible.roles.some((r) => r.secret_goal);
  const hasClues = bible.knowledge.some((k) => k.category === "clue" || k.category === "hidden");
  return hasHiddenEvents || hasSecrets || hasClues;
}

function hasSurvivalMetrics(bible: StoryBible): boolean {
  return bible.metrics.some((m) =>
    ["survival", "health", "danger", "threat"].some((kw) => m.id.includes(kw))
  );
}

function hasResourceMetrics(bible: StoryBible): boolean {
  return bible.metrics.some((m) =>
    ["resource", "gold", "influence", "power", "supply"].some((kw) => m.id.includes(kw))
  );
}
