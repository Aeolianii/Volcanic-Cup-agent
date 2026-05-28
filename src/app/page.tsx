"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function BookIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M12 6v12" />
      <path d="M8 8.5h3" />
      <path d="M8 11.5h2" />
    </svg>
  );
}

function CastleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
      <path d="M3 21h18" />
      <path d="M5 21V7l3-3v4l4-4 4 4V3l3 3v18" />
      <path d="M9 14h2" />
      <path d="M13 14h2" />
      <rect x="8" y="17" width="4" height="4" rx="0.5" />
      <rect x="12" y="17" width="4" height="4" rx="0.5" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <circle cx="15" cy="13" r="1.5" fill="currentColor" />
      <path d="M15 13h-3" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    roleplay: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="7" r="3" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h2" />
        <path d="M21 21v-2a4 4 0 0 0-4-4h-2" />
        <path d="M12 15l-2 2 2 2" />
      </svg>
    ),
    gm: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4c0 2-1.5 3.5-4 5.5C7.5 9.5 6 8 6 6a4 4 0 0 1 4-4z" />
        <path d="M12 12c-4 0-7 2.5-8 6h16c-1-3.5-4-6-8-6z" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
      </svg>
    ),
    rules: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L3 7l9 5 9-5-9-5z" />
        <path d="M3 17l9 5 9-5" />
        <path d="M3 12l9 5 9-5" />
      </svg>
    ),
    endings: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" />
        <path d="M12 8v4" />
      </svg>
    ),
  };

  return icons[type] || null;
}

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  const handleCreateStory = () => {
    router.push("/generate");
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim() || !playerName.trim()) return;
    const playerId = `player_${Date.now()}`;
    localStorage.setItem("player_id", playerId);
    localStorage.setItem("player_name", playerName);
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  const handleQuickDemo = () => {
    const playerId = `player_${Date.now()}`;
    localStorage.setItem("player_id", playerId);
    localStorage.setItem("player_name", playerName || "冒险者");
    router.push("/generate?demo=true");
  };

  const features = [
    { type: "roleplay" as const, label: "多人角色扮演", desc: "每个玩家拥有独特公开目标与秘密目标" },
    { type: "gm" as const, label: "AI GM 叙事", desc: "AI 驱动的游戏主持人实时生成剧情" },
    { type: "rules" as const, label: "动态规则引擎", desc: "智能裁决、知识边界、事件触发" },
    { type: "endings" as const, label: "多重结局", desc: "每一个选择都可能改变最终结局" },
  ];

  return (
    <div className="relative -my-8 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-16">
      {/* Background gradient orbs */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl animate-float" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-amber-600/5 blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      {/* Hero */}
      <div className="text-center mb-14 relative animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-700/30 bg-amber-900/20 text-amber-400 text-xs mb-6 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          AI-Powered Interactive Storytelling
        </div>

        <h1 className="font-fantasy text-6xl font-bold mb-4 tracking-wider">
          <span className="text-gradient-gold text-shadow-glow">AI Story Engine</span>
        </h1>

        <p className="text-parchment-300 text-lg max-w-2xl mx-auto leading-relaxed font-light">
          输入你的故事创意，AI 自动生成完整的互动叙事世界
          <br />
          <span className="text-parchment-500 text-base">
            多人角色扮演 &middot; 动态规则引擎 &middot; AI 驱动的 NPC 与 GM
          </span>
        </p>

        <div className="divider-ornament max-w-md mx-auto" />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        {/* Create Story */}
        <button
          onClick={handleCreateStory}
          className="panel-glow card-hover text-left group animate-in stagger-1"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-700/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <BookIcon />
          </div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-gradient-amber transition-all">
            创建故事
          </h3>
          <p className="text-parchment-500 text-sm leading-relaxed">
            输入世界观、角色和结局设定，由 AI 为你生成完整的 Story Bible。
          </p>
          <div className="mt-4 flex items-center gap-2 text-amber-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <span>开始创作</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
        </button>

        {/* Quick Demo */}
        <button
          onClick={handleQuickDemo}
          className="panel-glow card-hover text-left group animate-in stagger-2"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-700/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <CastleIcon />
          </div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-gradient-amber transition-all">
            Demo 故事
          </h3>
          <p className="text-parchment-500 text-sm leading-relaxed">
            直接体验「失落圣杯之夜」——西幻权谋推理，4 个角色，多重结局。
          </p>
          <div className="mt-4 flex items-center gap-2 text-amber-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <span>快速体验</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
        </button>

        {/* Join Room */}
        <div className="panel-glow text-left animate-in stagger-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-700/20 flex items-center justify-center mb-4">
            <DoorIcon />
          </div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2">加入房间</h3>
          <p className="text-parchment-500 text-sm mb-4 leading-relaxed">
            输入房间号和朋友一起游戏。
          </p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="你的名字"
            className="input-field text-sm mb-2.5"
          />
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="房间号 (6位)"
            maxLength={6}
            className="input-field text-sm mb-3"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!joinCode.trim() || !playerName.trim()}
            className="btn-primary text-sm w-full"
          >
            加入房间
          </button>
        </div>
      </div>

      {/* Feature list */}
      <div className="mt-16 w-full max-w-4xl animate-in stagger-4">
        <p className="text-center text-xs text-parchment-600 uppercase tracking-widest mb-6">核心特性</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={f.label}
              className="glass card-hover text-center p-5 animate-in"
              style={{ animationDelay: `${0.3 + i * 0.08}s` }}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 mb-3">
                <FeatureIcon type={f.type} />
              </div>
              <p className="text-sm text-parchment-200 font-medium mb-1">{f.label}</p>
              <p className="text-xs text-parchment-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
