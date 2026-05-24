import type { EndingCondition, EventEffect, StoryBible, StoryEvent, TriggerCondition } from "@/types";
import { WIDGET_KEYS } from "@/registry/widgetRegistry";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export function validateStoryBible(bible: StoryBible): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!bible) {
    return {
      valid: false,
      errors: [{ field: "story_bible", message: "Story Bible is required." }],
      warnings,
    };
  }

  const metricIds = new Set(bible.metrics.map((metric) => metric.id));
  const roleIds = new Set(bible.roles.map((role) => role.id));
  const npcIds = new Set(bible.npcs.map((npc) => npc.id));
  const eventIds = new Set(bible.events.map((event) => event.id));
  const chapterIds = new Set(bible.chapters.map((chapter) => chapter.id));
  const factionIds = new Set(bible.factions.map((faction) => faction.id));
  const locationIds = new Set(bible.roles.map((role) => role.starting_location).filter(Boolean));
  const knownFlags = collectKnownFlags(bible.events);
  const modifiedMetrics = collectModifiedMetrics(bible.events);
  const revealedKnowledge = collectRevealedKnowledge(bible.events);

  if (!bible.id) errors.push({ field: "id", message: "Story Bible must include an id." });
  if (!bible.title) errors.push({ field: "title", message: "Story Bible must include a title." });
  if (!bible.world_setting?.atmosphere) {
    errors.push({ field: "world_setting.atmosphere", message: "World setting needs a playable atmosphere summary." });
  }

  pushDuplicateIdErrors("roles", bible.roles.map((role) => role.id), errors);
  pushDuplicateIdErrors("npcs", bible.npcs.map((npc) => npc.id), errors);
  pushDuplicateIdErrors("metrics", bible.metrics.map((metric) => metric.id), errors);
  pushDuplicateIdErrors("events", bible.events.map((event) => event.id), errors);
  pushDuplicateIdErrors("chapters", bible.chapters.map((chapter) => chapter.id), errors);
  pushDuplicateIdErrors("endings", bible.endings.map((ending) => ending.id), errors);

  for (const role of bible.roles) {
    if (!role.id) errors.push({ field: `roles[${role.name || "?"}].id`, message: "Each player role must include an id." });
    if (!role.name) errors.push({ field: "roles[?].name", message: "Each player role must include a name." });
    if (!role.public_goal && !role.secret_goal) {
      errors.push({ field: `roles[${role.name || role.id}].goal`, message: "Each player role needs a public or secret goal." });
    }
    if (!role.starting_location) {
      errors.push({ field: `roles[${role.name || role.id}].starting_location`, message: "Each player role needs a starting location." });
    }
    if (role.abilities.length === 0) {
      warnings.push({ field: `roles[${role.name || role.id}].abilities`, message: "Role has no abilities, so action resolution will feel flat." });
    }
  }

  if (bible.roles.length < 2) {
    errors.push({ field: "roles", message: "At least two player roles are required for multiplayer play." });
  }

  for (const npc of bible.npcs) {
    if (!npc.goal) errors.push({ field: `npcs[${npc.name || npc.id}].goal`, message: "Each NPC needs a goal." });
    if (!npc.secret_goal) warnings.push({ field: `npcs[${npc.name || npc.id}].secret_goal`, message: "NPC has no secret goal, reducing agent tension." });
    if (npc.knowledge_scope !== "limited") {
      errors.push({ field: `npcs[${npc.name || npc.id}].knowledge_scope`, message: "NPC knowledge_scope must be limited." });
    }
    if ((npc as unknown as Record<string, unknown>).full_story_access) {
      errors.push({ field: `npcs[${npc.name || npc.id}]`, message: "NPCs must not have full_story_access." });
    }
    for (const [key, value] of Object.entries(npc.behavior_style || {})) {
      if (typeof value !== "number" || value < 0 || value > 100) {
        errors.push({ field: `npcs[${npc.name || npc.id}].behavior_style.${key}`, message: "NPC behavior style values must be numbers from 0 to 100." });
      }
    }
  }

  for (const faction of bible.factions) {
    for (const member of faction.members) {
      if (!roleIds.has(member) && !npcIds.has(member)) {
        warnings.push({ field: `factions[${faction.name || faction.id}].members`, message: `Faction member "${member}" does not match a role or NPC id.` });
      }
    }
    for (const relation of Object.keys(faction.relationships || {})) {
      if (!factionIds.has(relation)) {
        warnings.push({ field: `factions[${faction.name || faction.id}].relationships`, message: `Faction relationship "${relation}" points to an unknown faction.` });
      }
    }
  }

  for (const chapter of bible.chapters) {
    for (const keyEvent of chapter.key_events) {
      if (!eventIds.has(keyEvent)) {
        warnings.push({ field: `chapters[${chapter.title || chapter.id}].key_events`, message: `Key event "${keyEvent}" is not defined in events.` });
      }
    }
  }

  for (const event of bible.events) {
    validateEvent(event, metricIds, chapterIds, knownFlags, errors, warnings);
  }

  for (const ending of bible.endings) {
    if (!ending.conditions || ending.conditions.length === 0) {
      errors.push({ field: `endings[${ending.title || ending.id}].conditions`, message: "Each ending needs at least one condition." });
    }
    for (const condition of ending.conditions || []) {
      validateEndingCondition(condition, ending.title || ending.id, metricIds, eventIds, knownFlags, modifiedMetrics, errors, warnings);
    }
  }

  if (bible.endings.length < 2) {
    errors.push({ field: "endings", message: "At least two endings are required." });
  }

  for (const metric of bible.metrics) {
    if (!metric.id) errors.push({ field: "metrics[?].id", message: "Each metric must include an id." });
    if (!metric.type) errors.push({ field: `metrics[${metric.id}].type`, message: "Each metric must include a type." });
    if (metric.initial === undefined) errors.push({ field: `metrics[${metric.id}].initial`, message: "Each metric must include an initial value." });
    if (metric.type === "number") {
      const initial = Number(metric.initial);
      if (!Number.isFinite(initial)) {
        errors.push({ field: `metrics[${metric.id}].initial`, message: "Number metrics need numeric initial values." });
      }
      if (metric.min !== undefined && initial < metric.min) {
        errors.push({ field: `metrics[${metric.id}].initial`, message: "Initial value is below metric min." });
      }
      if (metric.max !== undefined && initial > metric.max) {
        errors.push({ field: `metrics[${metric.id}].initial`, message: "Initial value is above metric max." });
      }
    }
  }

  for (const knowledge of bible.knowledge) {
    for (const owner of knowledge.known_by) {
      if (!roleIds.has(owner) && !npcIds.has(owner) && owner !== "all") {
        warnings.push({ field: `knowledge[${knowledge.id}].known_by`, message: `Knowledge owner "${owner}" is not a known role, NPC, or all.` });
      }
    }
    if (!knowledge.revealed && knowledge.known_by.length === 0 && !revealedKnowledge.has(knowledge.id)) {
      warnings.push({ field: `knowledge[${knowledge.id}]`, message: "Hidden knowledge is not initially known and no event explicitly reveals it." });
    }
  }

  if (!bible.ui_config?.widgets) {
    errors.push({ field: "ui_config.widgets", message: "ui_config.widgets is required." });
  } else {
    for (const widget of bible.ui_config.widgets) {
      if (!(WIDGET_KEYS as readonly string[]).includes(widget.key)) {
        errors.push({
          field: `ui_config.widgets[${widget.key}]`,
          message: `Widget "${widget.key}" is not registered in WidgetRegistry.`,
        });
      }
    }
  }

  for (const locationId of locationIds) {
    const referencedInText = JSON.stringify(bible).includes(locationId);
    if (!referencedInText) {
      warnings.push({ field: "locations", message: `Starting location "${locationId}" is not referenced elsewhere in the Story Bible.` });
    }
  }

  validateRuntimeModules(bible, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateEvent(
  event: StoryEvent,
  metricIds: Set<string>,
  chapterIds: Set<string>,
  knownFlags: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!event.trigger) {
    errors.push({ field: `events[${event.title || event.id}].trigger`, message: "Each event needs a trigger." });
  } else {
    for (const condition of event.trigger.conditions || []) {
      validateTriggerCondition(condition, `events[${event.title || event.id}].trigger`, metricIds, knownFlags, warnings);
    }
  }
  if (!event.effects || event.effects.length === 0) {
    errors.push({ field: `events[${event.title || event.id}].effects`, message: "Each event needs at least one effect." });
  }
  if (event.chapter_id && !chapterIds.has(event.chapter_id)) {
    warnings.push({ field: `events[${event.title || event.id}].chapter_id`, message: `Event chapter "${event.chapter_id}" is not defined.` });
  }
  for (const effect of event.effects || []) {
    validateEffect(effect, event.title || event.id, metricIds, warnings);
  }
}

function validateTriggerCondition(
  condition: TriggerCondition,
  fieldPrefix: string,
  metricIds: Set<string>,
  knownFlags: Set<string>,
  warnings: ValidationWarning[]
): void {
  if (condition.field === "turn" || condition.field === "chapter") return;
  if (condition.field.startsWith("event_")) return;
  if (condition.field.startsWith("flag_")) {
    const flag = condition.field.replace(/^flag_/, "");
    if (!knownFlags.has(flag)) {
      warnings.push({ field: fieldPrefix, message: `Trigger references flag "${flag}", but no event sets it.` });
    }
    return;
  }
  if (metricIds.has(condition.field)) return;
  if (condition.operator === "exists") return;
  warnings.push({ field: fieldPrefix, message: `Trigger references unknown field "${condition.field}".` });
}

function validateEffect(
  effect: EventEffect,
  eventName: string,
  metricIds: Set<string>,
  warnings: ValidationWarning[]
): void {
  if (effect.type === "modify_metric" && !metricIds.has(effect.target)) {
    warnings.push({ field: `events[${eventName}].effects`, message: `Effect modifies unknown metric "${effect.target}".` });
  }
  if (effect.type === "set_flag" && !effect.target) {
    warnings.push({ field: `events[${eventName}].effects`, message: "set_flag effect should include a target flag." });
  }
}

function validateEndingCondition(
  condition: EndingCondition,
  endingName: string,
  metricIds: Set<string>,
  eventIds: Set<string>,
  knownFlags: Set<string>,
  modifiedMetrics: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (condition.type === "metric_threshold") {
    if (!condition.metric_id) {
      errors.push({ field: `endings[${endingName}].conditions`, message: "metric_threshold ending condition needs metric_id." });
      return;
    }
    if (!metricIds.has(condition.metric_id)) {
      errors.push({ field: `endings[${endingName}].conditions`, message: `Ending references unknown metric "${condition.metric_id}".` });
    } else if (!modifiedMetrics.has(condition.metric_id)) {
      warnings.push({ field: `endings[${endingName}].conditions`, message: `Metric "${condition.metric_id}" is used by an ending but no event modifies it. Rule Engine may still affect it.` });
    }
  }
  if (condition.type === "event_triggered" && condition.event_id && !eventIds.has(condition.event_id)) {
    errors.push({ field: `endings[${endingName}].conditions`, message: `Ending references unknown event "${condition.event_id}".` });
  }
  if (condition.type === "flag_set" && condition.flag && !knownFlags.has(condition.flag)) {
    warnings.push({ field: `endings[${endingName}].conditions`, message: `Ending references flag "${condition.flag}", but no event sets it.` });
  }
}

function validateRuntimeModules(
  bible: StoryBible,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!bible.runtime_modules) {
    warnings.push({
      field: "runtime_modules",
      message: "Missing runtime_modules; imported stories will be auto-filled, but explicit modules make behavior easier to review.",
    });
    return;
  }

  if (bible.runtime_modules.enabled.character_death && !bible.runtime_modules.enabled.ghost_mode) {
    warnings.push({
      field: "runtime_modules.enabled.ghost_mode",
      message: "When character death is enabled, ghost_mode is recommended so defeated players can keep spectating.",
    });
  }
  if (!bible.runtime_modules.enabled.character_death && bible.runtime_modules.consequence_mode === "lethal") {
    errors.push({
      field: "runtime_modules.consequence_mode",
      message: "consequence_mode should not be lethal when character_death is disabled.",
    });
  }
}

function collectKnownFlags(events: StoryEvent[]): Set<string> {
  const flags = new Set<string>(["ritual_stopped", "assassination_successful"]);
  for (const event of events) {
    for (const effect of event.effects || []) {
      if (effect.type === "set_flag" && effect.target) flags.add(effect.target);
      if (effect.type === "add_knowledge" && effect.value) flags.add(String(effect.value));
    }
  }
  return flags;
}

function collectModifiedMetrics(events: StoryEvent[]): Set<string> {
  const metrics = new Set<string>();
  for (const event of events) {
    for (const effect of event.effects || []) {
      if (effect.type === "modify_metric" && effect.target) metrics.add(effect.target);
    }
  }
  return metrics;
}

function collectRevealedKnowledge(events: StoryEvent[]): Set<string> {
  const knowledge = new Set<string>();
  for (const event of events) {
    for (const effect of event.effects || []) {
      if (effect.type === "add_knowledge" && effect.value) knowledge.add(String(effect.value));
    }
  }
  return knowledge;
}

function pushDuplicateIdErrors(
  field: string,
  ids: string[],
  errors: ValidationError[]
): void {
  const seen = new Set<string>();
  for (const id of ids.filter(Boolean)) {
    if (seen.has(id)) {
      errors.push({ field, message: `Duplicate id "${id}" found in ${field}.` });
    }
    seen.add(id);
  }
}
