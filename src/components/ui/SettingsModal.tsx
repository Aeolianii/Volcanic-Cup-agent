"use client";

import { useState, useEffect, useCallback } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-v4-pro");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  // Load current config on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setBaseUrl(data.config.baseUrl);
          setModel(data.config.model);
          setHasConfig(true);
        }
      })
      .catch(() => {});
  }, [open]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("llm_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
        if (parsed.model) setModel(parsed.model);
      } catch {}
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || apiKey.length < 3) {
      setMessage({ type: "error", text: "请输入有效的 API Key" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Save to localStorage for persistence
        localStorage.setItem("llm_config", JSON.stringify({
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim(),
        }));
        setHasConfig(true);
        setMessage({ type: "success", text: `已连接！模型：${data.config.model}` });
      } else {
        setMessage({ type: "error", text: data.error || "保存失败" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSaving(false);
    }
  }, [apiKey, baseUrl, model]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md panel-glow animate-fade-in-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-fantasy text-lg text-amber-400 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            API 设置
          </h2>
          <button
            onClick={onClose}
            className="text-parchment-500 hover:text-parchment-200 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {hasConfig && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-900/15 border border-emerald-600/30 text-xs text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            当前已配置 API 连接
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-parchment-400 uppercase tracking-wider mb-1.5 block">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="sk-..."
              className="input-field text-sm"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs text-parchment-400 uppercase tracking-wider mb-1.5 block">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://api.deepseek.com"
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-parchment-400 uppercase tracking-wider mb-1.5 block">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="deepseek-v4-pro"
              className="input-field text-sm"
            />
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-900/15 border border-emerald-600/30 text-emerald-300"
              : "bg-rose-900/15 border border-rose-600/30 text-rose-300"
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 text-sm"
          >
            {saving ? "连接中..." : "保存并连接"}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            关闭
          </button>
        </div>

        <p className="text-[10px] text-parchment-700 mt-4 text-center">
          API Key 仅存储在当前会话和浏览器本地。关闭页面后需重新输入。
        </p>
      </div>
    </div>
  );
}
