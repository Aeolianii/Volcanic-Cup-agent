"use client";

import { useState } from "react";
import { SettingsModal } from "@/components/ui/SettingsModal";

export function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="border-b border-midnight-700/50 bg-midnight-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <a href="/" className="group flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-midnight-950 font-bold text-sm shadow-lg shadow-amber-500/20">
              AI
            </span>
            <span className="font-fantasy text-lg text-amber-400 tracking-wider group-hover:text-amber-300 transition-colors">
              AI Story Engine
            </span>
          </a>
          <nav className="flex items-center gap-1 text-sm text-parchment-400">
            <a href="/" className="px-4 py-2 rounded-lg hover:text-amber-300 hover:bg-midnight-800/50 transition-all">
              首页
            </a>
            <a href="/generate" className="px-4 py-2 rounded-lg hover:text-amber-300 hover:bg-midnight-800/50 transition-all">
              生成故事
            </a>
            <button
              onClick={() => setSettingsOpen(true)}
              className="ml-2 px-3 py-2 rounded-lg hover:text-amber-300 hover:bg-midnight-800/50 transition-all flex items-center gap-1.5"
              title="API 设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              <span className="hidden sm:inline">API</span>
            </button>
          </nav>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
