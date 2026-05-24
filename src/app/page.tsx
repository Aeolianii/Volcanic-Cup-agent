"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in">
      {/* Hero Section */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs mb-8 tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-glow" />
          多人 AI 互动叙事
        </div>
        <h1 className="font-fantasy text-5xl md:text-6xl text-amber-400 mb-6 tracking-[0.15em] leading-tight">
          AI Story
          <br />
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            Foundry
          </span>
        </h1>
        <p className="text-parchment-400 text-lg max-w-2xl mx-auto leading-relaxed">
          输入你的故事创意，AI 自动生成完整的互动叙事世界
          <br />
          <span className="text-parchment-500">多人角色扮演 · 动态规则引擎 · AI 驱动的 NPC 与 GM</span>
          <br />
          <span className="text-parchment-600 text-sm">每个选择都将改变故事的走向</span>
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        {/* Create Story */}
        <button
          onClick={handleCreateStory}
          className="panel-interactive text-left group relative overflow-hidden animate-fade-in-up"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
              📖
            </div>
            <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-amber-300 transition-colors">
              创建故事
            </h3>
            <p className="text-parchment-500 text-sm leading-relaxed">
              输入世界观、角色和结局设定，由 AI 为你生成完整的 Story Bible。
            </p>
          </div>
        </button>

        {/* Quick Demo */}
        <button
          onClick={handleQuickDemo}
          className="panel-interactive text-left group relative overflow-hidden animate-fade-in-up animate-delay-100"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                🏰
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                推荐
              </span>
            </div>
            <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-amber-300 transition-colors">
              Demo 故事
            </h3>
            <p className="text-parchment-500 text-sm leading-relaxed">
              直接体验「失落圣杯之夜」——西幻权谋推理，4 个角色，多重结局。
            </p>
          </div>
        </button>

        {/* Join Room */}
        <div className="panel text-left animate-fade-in-up animate-delay-200">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-2xl mb-4">
            🚪
          </div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-3">加入房间</h3>
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
            className="input-field text-sm mb-2.5 font-mono tracking-widest"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!joinCode.trim() || !playerName.trim()}
            className="btn-primary text-sm w-full"
          >
            加入游戏
          </button>
        </div>
      </div>

      {/* Feature List */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center w-full max-w-3xl">
        {[
          { icon: "🎭", label: "多人角色扮演", desc: "选择角色参与故事" },
          { icon: "🧠", label: "AI GM 叙事", desc: "动态生成叙事内容" },
          { icon: "⚔️", label: "动态规则引擎", desc: "实时判定行动结果" },
          { icon: "🗺️", label: "多重结局", desc: "选择导向不同命运" },
        ].map((f, i) => (
          <div
            key={f.label}
            className="panel-interactive animate-fade-in-up"
            style={{ animationDelay: `${300 + i * 100}ms` }}
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="text-sm text-parchment-300 font-medium mb-0.5">{f.label}</p>
            <p className="text-xs text-parchment-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
