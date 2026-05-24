// ============================================================
// AI-related Types — GM output, NPC perspective, etc.
// ============================================================

export interface AIProvider {
  generateStoryBible(seed: StorySeed): Promise<StoryBible>;
  generateNarrative(context: GMContext): Promise<GMNarrativeOutput>;
  generateNPCAction(context: NPCContext): Promise<NPCActionOutput | null>;
  generateEndingNarrative(context: EndingContext): Promise<string>;
  parseAction(input: string, context: ActionParseContext): Promise<ParsedAction>;
}

export interface GMContext {
  story_bible: StoryBibleSummary;
  world_state_summary: WorldStateSummary;
  runtime_modules?: import("./story").StoryRuntimeModules;
  progression_guidance?: ProgressionGuidance;
  recent_events: string[];
  current_turn: number;
  current_chapter: number;
  last_action?: GMActionContext;
}

export interface ProgressionGuidance {
  progress_metric?: { id: string; label: string; value: unknown };
  stability_metric?: { id: string; label: string; value: unknown };
  pressure_metric?: { id: string; label: string; value: unknown };
  next_events: Array<{
    id: string;
    title: string;
    chapter_id?: string;
    missing_conditions: string[];
  }>;
  action_strategy: string[];
  avoid_action_keys: string[];
}

export interface GMActionContext {
  actor_id: string;
  actor_name: string;
  action_type: string;
  action_label: string;
  target: string;
  target_name: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
  raw_input?: string;
  success: boolean;
  public_result: string;
  private_result?: string;
  implicit_effects?: string[];
  state_updates: Array<{
    type: string;
    target?: string;
    fact_id?: string;
    metric?: string;
    delta?: number;
    value?: unknown;
  }>;
  triggered_events: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  npc_results?: Array<{
    npc_id: string;
    action_type?: string;
    intention?: string;
    success?: boolean;
    visibility?: string;
    public_result?: string;
    state_updates?: Array<{
      type: string;
      target?: string;
      fact_id?: string;
      metric?: string;
      delta?: number;
      value?: unknown;
    }>;
  }>;
}

export interface StoryBibleSummary {
  title: string;
  world_setting: string;
  genre_profile?: string;
  tone_tags?: string[];
  roles: { id: string; name: string; public_identity: string }[];
  npcs: { id: string; name: string; public_identity: string }[];
  chapters: { id: string; title: string }[];
  current_chapter_events: string[];
}

export interface WorldStateSummary {
  flags: Record<string, boolean>;
  metrics: { id: string; label: string; value: unknown }[];
  active_events: string[];
  player_locations: Record<string, string>;
}

export interface GMNarrativeOutput {
  narration: string;
  suggested_events: string[];
  revealed_information: RevealedInfo[];
  suggested_actions: SuggestedActionForGM[];
  mood: string;
}

export interface RevealedInfo {
  type: "fact" | "clue" | "event" | "location";
  title: string;
  content: string;
  visible_to: string[];
}

export interface SuggestedActionForGM {
  label: string;
  action_type: string;
  target: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
  context: string;
}

export interface NPCContext {
  npc_id: string;
  npc_name: string;
  npc_personality: string;
  npc_goal: string;
  npc_secret_goal: string;
  local_view: NPCLocalView;
}

export interface NPCLocalView {
  self_information: string[];
  public_information: string[];
  discovered_information: string[];
  known_facts: string[];
  known_events: string[];
  known_players: { id: string; name: string; public_identity: string; location: string }[];
  relationships: Record<string, number>;
  recent_actions: import("./action").KnownPlayerAction[];
  current_public_events: string[];
  visible_metrics: { id: string; value: unknown }[];
  observations: string[];
  threat_assessment: { target_id: string; level: number; reasons: string[] }[];
  runtime: import("./action").NPCRuntimeState;
}

export interface NPCActionOutput {
  intention: string;
  action_type: string;
  target: string;
  method: string;
  reasoning_visible: string;
  risk_level: "low" | "medium" | "high";
  visibility?: "public" | "partial" | "secret";
  effect?: import("./action").NPCActionEffect;
}

export interface ActionParseContext {
  player_id: string;
  player_role: string;
  current_location: string;
  known_facts: string[];
  active_events: string[];
  runtime_modules?: import("./story").StoryRuntimeModules;
}

export interface ParsedAction {
  action_type: string;
  target: string;
  method: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
}

export interface EndingContext {
  ending_title: string;
  ending_description: string;
  world_state_summary: WorldStateSummary;
  key_events: string[];
  player_contributions: Record<string, string[]>;
}

// Import types needed
import type { StoryBible } from "./story";
import type { StorySeed } from "./story";
