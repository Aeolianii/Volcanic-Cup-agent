// Engine barrel exports
export { validateStoryBible } from "./storyBibleValidator";
export type { ValidationResult, ValidationError, ValidationWarning } from "./storyBibleValidator";

export { createWorldState, applyUpdates, getMetricValue, isFlagSet, getPlayerKnowledge, getNPCKnowledge } from "./worldStateEngine";

export { processPlayerAction, processNPCAction } from "./ruleEngine";

export { parsePlayerAction, parseSuggestedAction, detectActionInChat } from "./actionParser";

export { extractFeatures } from "./featureExtractor";
export type { StoryFeatures } from "./featureExtractor";

export { selectRulePacks } from "./rulePackSelector";

export { generateMetrics } from "./metricGenerator";

export { generateUIConfig } from "./uiConfigGenerator";

export { checkEventTriggers } from "./eventTriggerSystem";
export type { TriggeredEvent } from "./eventTriggerSystem";

export { checkChapterTransition } from "./storyController";
export type { ChapterTransition } from "./storyController";

export { checkEndings } from "./endingJudge";
export type { EndingResult, EndingStatus } from "./endingJudge";

export { buildNPCLocalView } from "./npcKnowledgeFilter";

export { generateNPCActionProposal } from "./npcPlanner";

export { generateGMNarrative } from "./aiGM";

export { analyzeStory } from "./storyAnalyzer";
export type { StoryAnalysis, StoryFeaturesAnalysis } from "./storyAnalyzer";

export { adaptStory } from "./storyAdapter";
export type { AdaptedStory, StoryAdditions, ChapterSuggestion } from "./storyAdapter";

export { generateStoryBible } from "./storyBibleGenerator";
