"use client";

import type { VisibleMetric } from "@/types";

interface MetricPanelProps {
  metrics: VisibleMetric[];
}

export function MetricPanel({ metrics }: MetricPanelProps) {
  if (metrics.length === 0) {
    return (
      <div className="panel">
        <h3 className="font-fantasy text-amber-400 text-sm mb-2">指标</h3>
        <p className="text-parchment-600 text-sm">暂无可见指标</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-4">局势指标</h3>
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.metric_id}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-parchment-400">{metric.label}</span>
              {metric.type === "number" && (
                <span className="text-parchment-500 font-mono text-xs">{String(metric.value)}</span>
              )}
            </div>
            {metric.type === "number" && (
              <div className="w-full bg-midnight-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-600 to-amber-400 h-1.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, Number(metric.value)))}%` }}
                />
              </div>
            )}
            {metric.type === "boolean" && (
              <span className={`badge text-xs ${metric.value ? "badge-emerald" : "badge-rose"}`}>
                {metric.value ? "是" : "否"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
