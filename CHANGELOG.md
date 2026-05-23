# Changelog

## v1.2 - 2026-05-24

### Story Bible and Generation

- Reworked story analysis and adaptation so generated events, roles, factions, abilities, and UI panels follow the imported story premise instead of falling back to rigid genre templates.
- Improved Story Bible generation and validation to catch missing goals, invalid NPC knowledge scope, unsupported widgets, thin ending sets, and unsafe story access.
- Added stronger demo/mock generation paths while keeping imported-story behavior explicit when AI generation fails.

### AI GM, Rule Engine, and World State

- Routed player action results into AI GM context so the central narration reflects the selected action, rule result, world state changes, triggered events, and newly revealed information.
- Prevented AI GM and NPC output from leaking internal IDs such as event IDs, target aliases, metric keys, and player IDs into player-facing text.
- Added action target normalization for NPCs, roles, events, current locations, and connected locations before rule settlement.
- Improved social, investigation, self-reflection, clue, metric, relationship, and event settlement so actions produce concrete consequences rather than only generic success messages.
- Preserved the rule that all world changes pass through the Rule Engine; AI GM only returns narration, suggested events, revealed information, and suggested actions.

### Interaction Flow and Latency

- Added immediate pending feedback for suggested actions and free actions so players can see that an action is being processed.
- Updated suggested actions after every settlement and filtered out the just-used action so the next choices reflect the latest World State.
- Optimized action settlement latency by running ending checks and GM narration in parallel after the state is settled.
- Added parallel high-token AI narration requests for post-action GM output and accepted the first valid JSON response without reducing prompt quality.
- Reduced demo fallback wait time while keeping imported stories strict: demo can use playable fallback narration, imported stories clearly report when AI narration was not generated.

### Player-Facing UI

- Fixed the GM sender label so it no longer appears as a mistranslated vehicle-related label.
- Made known facts expandable so all player-visible facts can be reviewed instead of hiding the extra facts behind an inaccessible count.
- Improved action panels, free action input, and UI builder state handling for disabled, pending, and updated suggestions.
- Cleaned player-facing evidence, facts, role information, and narrative text so they show readable story terms rather than raw engine parameters.

### Demo: Lost Holy Grail Night

- Improved the demo loop for creating a room, selecting a role, starting the story, submitting recommended/free actions, receiving GM narration, refreshing suggestions, triggering events, and checking endings.
- Added more concrete feedback for repeated conversations with NPCs such as the Archmage, including actionable clues and follow-up directions.
- Kept demo fallback narration available for playability, while avoiding that fallback for imported custom stories.

### Validation

- Built successfully with `npm run build`.
- Restarted and tested the local server at `http://localhost:3000`.
- Verified a demo recommended action round-trip through action parsing, rule settlement, GM narration, and suggested-action refresh.
