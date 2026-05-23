// Barrel export for all types
export * from "./story";
export * from "./role";
export * from "./metric";
export * from "./worldState";
export * from "./room";
export * from "./action";
export * from "./ai";
export * from "./chat";

// Re-export commonly used types explicitly for convenience
export type { StorySeed, StoryBible, WorldSetting, Faction, Chapter, KnowledgeEntry, UIConfig, WidgetConfig } from "./story";
export type { Role, NPC, Ability, BehaviorStyle } from "./role";
export type { Metric, MetricState, StoryEvent, EventTrigger, TriggerCondition, EventEffect, Ending, EndingCondition } from "./metric";
export type { WorldState, EventState, RelationshipState, LocationState, KnowledgeState, PlayerKnowledge, NPCKnowledge } from "./worldState";
export type { Room, RoomStatus, Player, PlayerView, VisibleMetric, ActiveEvent, SuggestedAction } from "./room";
export type { StructuredAction, ActionType, ActionCategory, RuleResult, StateUpdate, StateUpdateType, RollResult, Modifier, ActionProposal } from "./action";
export type { AIProvider, GMContext, GMNarrativeOutput, NPCContext, NPCLocalView, NPCActionOutput, ActionParseContext, ParsedAction, EndingContext } from "./ai";
export type { ChatMessage, ChatHint } from "./chat";
