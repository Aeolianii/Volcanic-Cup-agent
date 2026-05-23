import type { ComponentType } from "react";

/**
 * Widget Registry
 * Maps widget keys to React components.
 * AI outputs widget keys; the frontend renders only registered components.
 */
export interface WidgetEntry {
  key: string;
  label: string;
  description: string;
  component: ComponentType<unknown> | null; // lazy-loaded
}

const registry = new Map<string, WidgetEntry>();

export function registerWidget(entry: WidgetEntry): void {
  registry.set(entry.key, entry);
}

export function getWidget(key: string): WidgetEntry | undefined {
  return registry.get(key);
}

export function hasWidget(key: string): boolean {
  return registry.has(key);
}

export function getAllWidgets(): WidgetEntry[] {
  return Array.from(registry.values());
}

export const WIDGET_KEYS = [
  "ChatPanel",
  "NarrativePanel",
  "RolePanel",
  "MetricPanel",
  "EventPanel",
  "FactionPanel",
  "EvidencePanel",
  "SuggestedActionsPanel",
  "FreeActionInput",
  "PlayerInfoPanel",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

/**
 * Initialize widget registry entries.
 * Components are set to null initially — they get populated
 * when the actual component modules are imported.
 */
export function initWidgetRegistry(): void {
  const entries: Omit<WidgetEntry, "component">[] = [
    { key: "ChatPanel", label: "RP 聊天", description: "角色扮演聊天面板" },
    { key: "NarrativePanel", label: "GM 叙事", description: "显示 GM 叙事内容" },
    { key: "RolePanel", label: "角色信息", description: "当前角色面板" },
    { key: "MetricPanel", label: "指标面板", description: "显示可见指标" },
    { key: "EventPanel", label: "事件面板", description: "当前活跃事件" },
    { key: "FactionPanel", label: "阵营面板", description: "阵营信息展示" },
    { key: "EvidencePanel", label: "线索面板", description: "已知线索展示" },
    { key: "SuggestedActionsPanel", label: "推荐行动", description: "系统推荐行动按钮" },
    { key: "FreeActionInput", label: "自由行动", description: "自定义行动输入" },
    { key: "PlayerInfoPanel", label: "玩家信息", description: "玩家可见信息汇总" },
  ];

  for (const entry of entries) {
    if (!registry.has(entry.key)) {
      registry.set(entry.key, { ...entry, component: null });
    }
  }
}
