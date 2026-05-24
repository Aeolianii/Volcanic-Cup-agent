# Agent Contracts

## Story Bible Designer

Return one JSON `StoryBible`.

Required qualities:
- At least 2 player roles and 2 endings.
- NPC `knowledge_scope` is always `limited`.
- Each NPC has `goal`, `secret_goal`, `memory`, `initial_knowledge`, and `behavior_style`.
- Events form a reachable chain using `turn`, metrics, flags, or prior events.
- Endings reference existing metrics, events, or flags.
- Runtime modules match the genre. Disable lethal actions for romance, campus, workplace, and comedy unless the seed explicitly asks for lethal stakes.

## Story Bible Validator

Return:

```json
{
  "errors": [],
  "warnings": [],
  "repair_patches": [],
  "confidence": 0.0
}
```

Use errors for broken schema, missing ids, unknown ending references, invalid NPC knowledge scope, and unregistered widgets. Use warnings for weak playability, likely unreachable flags, hidden knowledge with no reveal path, or flat NPC motivations.

## GM Narrative Skill

Return:

```json
{
  "narration": "",
  "suggested_events": [],
  "revealed_information": [],
  "suggested_actions": [],
  "mood": ""
}
```

The GM may summarize consequences already produced by Rule Engine. It must not invent state changes, reveal private facts outside the context, or repeat the previous action.

## NPC Agent Designer

Return:

```json
{
  "intention": "",
  "action_type": "",
  "target": "",
  "method": "",
  "reasoning_visible": "",
  "risk_level": "low",
  "visibility": "partial",
  "effect": { "type": "none" }
}
```

Use only the NPC profile and `NPCLocalView`. The NPC can obstruct, mislead, protect secrets, influence relationships, or accelerate its plan. The Rule Engine decides success and applies effects.

## Playtest Agent

Return:

```json
{
  "turns_run": 0,
  "triggered_events": [],
  "reached_ending": null,
  "stalls": [],
  "warnings": [],
  "suggested_repairs": []
}
```

Prefer deterministic sample actions that exercise investigation, social, and progression paths.
