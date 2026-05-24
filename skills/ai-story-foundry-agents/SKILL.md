---
name: ai-story-foundry-agents
description: Use when working on this AI multiplayer narrative game, especially Story Bible generation, Story Bible validation, GM narration, NPC planning, playtest simulation, knowledge-boundary checks, or model prompt changes. This skill keeps AI creative agents inside the project's Story Bible -> World State -> Rule Engine -> GM/NPC proposal architecture.
---

# AI Story Foundry Agents

## Workflow

1. Read the relevant engine entry points before editing: `src/engine/storyBibleGenerator.ts`, `src/engine/storyBibleValidator.ts`, `src/engine/ruleEngine.ts`, `src/engine/aiGM.ts`, `src/engine/npcPlanner.ts`, and `src/engine/worldStateEngine.ts`.
2. Keep state mutation deterministic. AI agents may generate Story Bible drafts, narration, parsed actions, NPC proposals, repair suggestions, and playtest reports. They must not directly modify World State.
3. Route player and NPC effects through Rule Engine or existing state update functions.
4. Preserve knowledge boundaries. GM can use player-visible summaries; NPC agents can use only NPC profile plus `NPCLocalView`.
5. Run `npm run build` after TypeScript changes. Run `npm run playtest` after engine, Story Bible, GM, NPC, or validator changes.

## Agent Roles

- Story Bible Designer: expand a seed into schema-compliant roles, NPCs, factions, metrics, events, endings, runtime modules, and UI config.
- Story Bible Validator: check schema, reachability, ending conditions, NPC knowledge leaks, widget keys, and missing metric/event/flag references.
- GM Narrative Skill: produce narration and suggested actions only. Never write state.
- NPC Agent Designer: produce one NPC action proposal from local knowledge, memory, threat assessment, and goals.
- Playtest Agent: simulate turns and report stalls, repeated suggestions, unreachable events, ending risk, and minimal repairs.

## Output Rules

When prompting a model for game runtime output, require valid JSON and reject Markdown. Prefer the contracts in `src/agents/agentSkills.ts`; they are the source-controlled agent registry used by runtime prompts.

For detailed prompt constraints, read `references/contracts.md`.
