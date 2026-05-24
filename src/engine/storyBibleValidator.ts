import type { StoryBible } from "@/types";
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

  if (!bible.id) errors.push({ field: "id", message: "StoryBible 必须有 id" });
  if (!bible.title) errors.push({ field: "title", message: "StoryBible 必须有 title" });

  for (const role of bible.roles) {
    if (!role.id) errors.push({ field: `roles[${role.name}].id`, message: "角色必须有 id" });
    if (!role.name) errors.push({ field: "roles[?].name", message: "角色必须有 name" });
    if (!role.public_goal && !role.secret_goal) {
      errors.push({ field: `roles[${role.name}].goal`, message: `角色 ${role.name} 必须有 public_goal 或 secret_goal` });
    }
  }

  if (bible.roles.length < 2) {
    errors.push({ field: "roles", message: "玩家角色数量至少 2 个" });
  }

  for (const npc of bible.npcs) {
    if (!npc.goal) errors.push({ field: `npcs[${npc.name}].goal`, message: `NPC ${npc.name} 必须有 goal` });
    if (npc.knowledge_scope !== "limited") {
      errors.push({ field: `npcs[${npc.name}].knowledge_scope`, message: `NPC ${npc.name} 的 knowledge_scope 必须为 "limited"` });
    }
    if ((npc as unknown as Record<string, unknown>).full_story_access) {
      errors.push({ field: `npcs[${npc.name}]`, message: "NPC 不得拥有 full_story_access" });
    }
  }

  for (const event of bible.events) {
    if (!event.trigger) errors.push({ field: `events[${event.title}].trigger`, message: `事件 ${event.title} 必须有 trigger` });
    if (!event.effects || event.effects.length === 0) {
      errors.push({ field: `events[${event.title}].effects`, message: `事件 ${event.title} 必须有 effects` });
    }
  }

  for (const ending of bible.endings) {
    if (!ending.conditions || ending.conditions.length === 0) {
      errors.push({ field: `endings[${ending.title}].conditions`, message: `结局 ${ending.title} 必须有 conditions` });
    }
  }

  if (bible.endings.length < 2) {
    errors.push({ field: "endings", message: "结局至少 2 个" });
  }

  for (const metric of bible.metrics) {
    if (!metric.id) errors.push({ field: "metrics[?].id", message: "Metric 必须有 id" });
    if (!metric.type) errors.push({ field: `metrics[${metric.id}].type`, message: "Metric 必须有 type" });
    if (metric.initial === undefined) errors.push({ field: `metrics[${metric.id}].initial`, message: "Metric 必须有 initial" });
  }

  if (!bible.ui_config?.widgets) {
    errors.push({ field: "ui_config.widgets", message: "ui_config.widgets 必须存在" });
  } else {
    for (const widget of bible.ui_config.widgets) {
      if (!(WIDGET_KEYS as readonly string[]).includes(widget.key)) {
        errors.push({
          field: `ui_config.widgets[${widget.key}]`,
          message: `Widget "${widget.key}" 不存在于 WidgetRegistry 中`,
        });
      }
    }
  }

  if (!bible.runtime_modules) {
    warnings.push({
      field: "runtime_modules",
      message: "缺少运行模块配置；导入故事会在入库前自动补全，但建议生成 Story Bible 时明确包含。",
    });
  } else {
    if (bible.runtime_modules.enabled.character_death && !bible.runtime_modules.enabled.ghost_mode) {
      warnings.push({
        field: "runtime_modules.enabled.ghost_mode",
        message: "启用角色死亡时建议同时启用幽灵旁观。",
      });
    }
    if (!bible.runtime_modules.enabled.character_death && bible.runtime_modules.consequence_mode === "lethal") {
      errors.push({
        field: "runtime_modules.consequence_mode",
        message: "未启用角色死亡时 consequence_mode 不应为 lethal。",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
