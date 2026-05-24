import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

registerTypeScriptRequireHook();

const { DEMO_STORY_BIBLE: demoStoryBible } = requireFromRoot("src/mock/demoStoryBible.ts");
const { validateStoryBible } = requireFromRoot("src/engine/storyBibleValidator.ts");
const { createWorldState, applyUpdates, decrementActiveModifiers } = requireFromRoot("src/engine/worldStateEngine.ts");
const { processPlayerAction } = requireFromRoot("src/engine/ruleEngine.ts");
const { checkEventTriggers } = requireFromRoot("src/engine/eventTriggerSystem.ts");
const { checkChapterTransition } = requireFromRoot("src/engine/storyController.ts");
const { checkEndings } = requireFromRoot("src/engine/endingJudge.ts");
const { runDueNPCTurns } = requireFromRoot("src/engine/npcTurnSystem.ts");
const { consumePlayerAction, maybeAdvanceRound, buildRoundPressureUpdates } = requireFromRoot("src/engine/turnSystem.ts");
const { mockAIProvider } = requireFromRoot("src/mock/mockAIProvider.ts");

const maxTurns = Number(process.argv.find((arg) => arg.startsWith("--turns="))?.split("=")[1] || 20);
const validation = validateStoryBible(demoStoryBible);
const report = await runPlaytest(demoStoryBible, maxTurns);

console.log(JSON.stringify({
  story_id: demoStoryBible.id,
  validation,
  ...report,
}, null, 2));

if (!validation.valid || report.stalls.length > 0) {
  process.exitCode = 1;
}

async function runPlaytest(bible, turns) {
  let state = createWorldState(bible.id, "PLAY01", bible);
  const playerIds = bible.roles.slice(0, Math.min(4, bible.roles.length)).map((role) => role.id);
  const players = playerIds.map((id) => ({ player_id: id, role_id: id }));
  let turnsRun = 0;

  for (const role of bible.roles) {
    const location = state.locations.find((item) => item.id === role.starting_location);
    if (location && !location.present_characters.includes(role.id)) {
      location.present_characters.push(role.id);
    }
  }

  const triggeredEvents = [];
  const stalls = [];
  const warnings = [];
  let reachedEnding = null;

  for (let turn = 1; turn <= turns; turn += 1) {
    turnsRun = turn;
    const actorId = playerIds[(turn - 1) % playerIds.length];
    const action = buildAction(actorId, turn, bible, state);
    const beforeTriggeredCount = state.events.filter((event) => event.triggered).length;
    const beforeChapter = state.chapter;

    const result = processPlayerAction(action, state, bible);
    state = applyUpdates(state, result.state_updates);
    state = consumePlayerAction(state, actorId, action);
    state = decrementActiveModifiers(state);

    const npcTurn = await runDueNPCTurns(state, bible, mockAIProvider);
    state = npcTurn.worldState;

    const events = checkEventTriggers(state, bible);
    for (const eventResult of events) {
      triggeredEvents.push(eventResult.event.id);
      state = applyUpdates(state, [
        { type: "trigger_event", target: eventResult.event.id },
        ...eventResult.event.effects.flatMap((effect) => eventEffectToStateUpdates(effect, actorId)),
      ]);
    }

    const chapterTransition = checkChapterTransition(state, bible);
    if (chapterTransition.should_transition) {
      state = {
        ...state,
        chapter: chapterTransition.to_chapter,
        flags: {
          ...state.flags,
          [`chapter_${chapterTransition.to_chapter}_started`]: true,
        },
      };
    }
    const previousRound = state.turn_state?.current_round || state.turn;
    state = maybeAdvanceRound(state, players);
    if ((state.turn_state?.current_round || state.turn) !== previousRound) {
      state = applyUpdates(state, buildRoundPressureUpdates(state, bible));
    }

    const ending = checkEndings(state, bible);
    if (ending.reached) {
      reachedEnding = ending.ending?.id || null;
      break;
    }

    const afterTriggeredCount = state.events.filter((event) => event.triggered).length;
    const progressed =
      afterTriggeredCount > beforeTriggeredCount ||
      state.chapter !== beforeChapter ||
      result.state_updates.some((update) => update.type === "metric_change");

    if (!progressed && turn >= 4) {
      stalls.push({
        turn,
        actor_id: actorId,
        action_type: action.action_type,
        target: action.target,
        reason: "No event, chapter, or metric progress occurred this turn.",
      });
      break;
    }
  }

  const untriggeredEvents = bible.events
    .filter((event) => !state.events.find((item) => item.event_id === event.id)?.triggered)
    .map((event) => event.id);

  if (triggeredEvents.length === 0) warnings.push("No events triggered during playtest.");
  if (!reachedEnding) warnings.push("No ending reached within the configured turn limit.");

  return {
    turns_run: turnsRun,
    current_round: state.turn_state?.current_round || state.turn,
    current_chapter: state.chapter,
    triggered_events: Array.from(new Set(triggeredEvents)),
    untriggered_events: untriggeredEvents,
    reached_ending: reachedEnding,
    final_metrics: state.metrics,
    stalls,
    warnings,
    suggested_repairs: buildRepairHints(untriggeredEvents, reachedEnding),
  };
}

function buildAction(actorId, turn, bible, state) {
  const activeEvent = state.events.find((event) => event.triggered);
  const storyEvent = bible.events.find((event) => event.id === activeEvent?.event_id) || bible.events[0];
  const npc = bible.npcs[(turn - 1) % Math.max(1, bible.npcs.length)];
  const actionTypes = ["investigate", "search", "talk", "persuade", "decode", "command"];
  const actionType = actionTypes[(turn - 1) % actionTypes.length];

  return {
    actor_id: actorId,
    actor_type: "player",
    action_source: "free_action",
    action_type: actionType,
    target: actionType === "talk" || actionType === "persuade" ? npc?.id || "public_situation" : storyEvent?.id || "current_location",
    method: actionType === "talk" ? "careful_conversation" : "playtest_probe",
    intent: actionType === "command" ? "resolve_or_stabilize" : "find_clues",
    risk_level: actionType === "command" ? "high" : "medium",
    raw_input: `playtest ${actionType}`,
  };
}

function eventEffectToStateUpdates(effect, playerId) {
  if (effect.type === "set_flag") return [{ type: "set_flag", flag: effect.target, value: effect.value }];
  if (effect.type === "modify_metric") return [{ type: "metric_change", metric: effect.target, delta: Number(effect.value) || 0 }];
  if (effect.type === "add_knowledge") {
    return [
      { type: "add_known_fact", target: playerId, fact_id: String(effect.value || effect.target) },
      { type: "set_flag", flag: String(effect.value || effect.target), value: true },
    ];
  }
  if (effect.type === "change_location") return [{ type: "change_location", target: playerId, value: String(effect.value || effect.target) }];
  if (effect.type === "reveal_event") return [{ type: "set_flag", flag: String(effect.target), value: effect.value }];
  return [];
}

function buildRepairHints(untriggeredEvents, reachedEnding) {
  const hints = [];
  if (untriggeredEvents.length > 0) {
    hints.push(`Review trigger conditions for untriggered events: ${untriggeredEvents.slice(0, 5).join(", ")}.`);
  }
  if (!reachedEnding) {
    hints.push("Add at least one mid-game action path that pushes metrics toward the highest-priority ending.");
  }
  return hints;
}

function requireFromRoot(relativePath) {
  return Module.createRequire(import.meta.url)(path.join(root, relativePath));
}

function registerTypeScriptRequireHook() {
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolve.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  Module._extensions[".ts"] = function loadTs(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}
