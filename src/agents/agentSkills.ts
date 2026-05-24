export type AgentSkillKey =
  | "story-bible-designer"
  | "story-bible-validator"
  | "gm-narrative-skill"
  | "npc-agent-designer"
  | "playtest-agent";

export interface AgentSkillDefinition {
  key: AgentSkillKey;
  display_name: string;
  purpose: string;
  hard_rules: string[];
  output_contract: string[];
}

export const AGENT_SKILLS: Record<AgentSkillKey, AgentSkillDefinition> = {
  "story-bible-designer": {
    key: "story-bible-designer",
    display_name: "Story Bible Designer",
    purpose: "Expand a user seed into a playable Story Bible that matches the project schema.",
    hard_rules: [
      "Create player roles with public goals, secret goals, starting knowledge, and useful abilities.",
      "Create NPCs with limited knowledge, goals, secret goals, memory, and behavior_style values from 0 to 100.",
      "Create event chains whose triggers can be reached through player actions and metric changes.",
      "Create at least three endings with distinct priorities and metric/event conditions.",
      "Do not give NPCs omniscient knowledge or direct world-state write privileges.",
    ],
    output_contract: [
      "Return one JSON object shaped as StoryBible.",
      "Use stable ids with lowercase letters, numbers, and underscores.",
      "Include runtime_modules and ui_config.",
    ],
  },
  "story-bible-validator": {
    key: "story-bible-validator",
    display_name: "Story Bible Validator",
    purpose: "Find logic, reachability, knowledge-boundary, and UI contract problems before a story is run.",
    hard_rules: [
      "Treat the deterministic validator as the source of truth for schema and reachability issues.",
      "Flag endings that reference missing metrics, events, or flags.",
      "Flag NPC knowledge leaks, full_story_access, and non-limited knowledge_scope.",
      "Prefer repair suggestions that preserve the author's premise.",
    ],
    output_contract: [
      "Return JSON with errors, warnings, repair_patches, and confidence.",
      "Do not rewrite the full Story Bible unless explicitly asked.",
    ],
  },
  "gm-narrative-skill": {
    key: "gm-narrative-skill",
    display_name: "GM Narrative Skill",
    purpose: "Generate narration, revealed information, mood, and next actions from the current World State.",
    hard_rules: [
      "GM may narrate and suggest actions, but must never directly modify World State.",
      "Do not reveal hidden facts unless they appear in the provided player-visible context.",
      "Suggested actions must target known NPCs, locations, events, public situations, or self_goal.",
      "Avoid repeating the previous action by label or action signature.",
    ],
    output_contract: [
      "Return JSON fields: narration, suggested_events, revealed_information, suggested_actions, mood.",
      "Use 3 to 5 suggested_actions.",
    ],
  },
  "npc-agent-designer": {
    key: "npc-agent-designer",
    display_name: "NPC Agent Designer",
    purpose: "Plan one NPC turn from the NPC's local view, persistent memory, threat model, and goals.",
    hard_rules: [
      "Use only the NPC profile and NPCLocalView payload.",
      "Never assume the full Story Bible, ending conditions, or private player knowledge.",
      "NPC actions are proposals; Rule Engine decides success and effects.",
      "Do not permanently delete critical clues or target the same player forever.",
    ],
    output_contract: [
      "Return JSON fields: intention, action_type, target, method, reasoning_visible, risk_level, visibility, effect.",
      "effect.type must be success_rate_modifier, metric_change, relationship_change, false_evidence, or none.",
    ],
  },
  "playtest-agent": {
    key: "playtest-agent",
    display_name: "Playtest Agent",
    purpose: "Simulate player behavior over multiple turns and report stalls, repeated suggestions, unreachable events, and ending risk.",
    hard_rules: [
      "Use deterministic engine entry points whenever possible.",
      "Treat AI output as replaceable; verify progression through World State, metrics, events, and endings.",
      "Report the first turn where the story stalls and the likely missing condition.",
    ],
    output_contract: [
      "Return JSON with turns_run, triggered_events, reached_ending, stalls, warnings, and suggested_repairs.",
    ],
  },
};

export function buildAgentSkillSystemPrompt(key: AgentSkillKey): string {
  const skill = AGENT_SKILLS[key];
  return [
    `${skill.display_name}: ${skill.purpose}`,
    "Hard rules:",
    ...skill.hard_rules.map((rule) => `- ${rule}`),
    "Output contract:",
    ...skill.output_contract.map((contract) => `- ${contract}`),
  ].join("\n");
}
