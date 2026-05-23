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
        <p className="text-parchment-500 text-sm">暂无可见指标</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm mb-3">局势指标</h3>
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.metric_id}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-parchment-300">{metric.label}</span>
              {metric.type === "number" && (
                <span className="text-parchment-400 font-mono">{String(metric.value)}</span>
              )}
            </div>
            {metric.type === "number" && (
              <div className="w-full bg-midnight-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, Number(metric.value)))}%` }}
                />
              </div>
            )}
            {metric.type === "boolean" && (
              <span className={`text-xs ${metric.value ? "text-green-400" : "text-red-400"}`}>
                {metric.value ? "是" : "否"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
