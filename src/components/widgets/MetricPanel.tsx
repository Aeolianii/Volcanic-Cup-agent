"use client";

import type { VisibleMetric } from "@/types";

interface MetricPanelProps {
  metrics: VisibleMetric[];
}

export function MetricPanel({ metrics }: MetricPanelProps) {
  return (
    <div className="panel">
      <h3 className="font-fantasy text-amber-400 text-sm flex items-center gap-2 mb-3">
        <span>📊</span> 局势指标
        {metrics.length > 0 && (
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full ml-auto">
            {metrics.length}
          </span>
        )}
      </h3>

      {metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-parchment-500 gap-1">
          <span className="text-xl opacity-40">📈</span>
          <p className="text-sm">暂无可见指标</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.metric_id}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-parchment-300 font-medium">{metric.label}</span>
                {metric.type === "number" && (
                  <span className="text-parchment-400 font-mono tabular-nums">{String(metric.value)}%</span>
                )}
              </div>
              {metric.type === "number" && (
                <div className="w-full bg-midnight-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-600 to-amber-400"
                    style={{ width: `${Math.min(100, Math.max(0, Number(metric.value)))}%` }}
                  />
                </div>
              )}
              {metric.type === "boolean" && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
                  metric.value
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${metric.value ? "bg-emerald-400" : "bg-red-400"}`} />
                  {metric.value ? "是" : "否"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
