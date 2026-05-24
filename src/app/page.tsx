"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
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
    <div className="relative isolate flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center overflow-hidden py-16">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 -z-30 w-screen -translate-x-1/2 bg-no-repeat"
        style={{
          backgroundImage: "url('/images/home-background.png')",
          backgroundSize: "100% 100%",
          backgroundPosition: "center center",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 -z-20 w-screen -translate-x-1/2"
        style={{
          background:
            "radial-gradient(circle at center 34%, rgba(245, 158, 11, 0.04), rgba(10, 12, 24, 0.2) 38%, rgba(10, 12, 24, 0.54) 78%), linear-gradient(90deg, rgba(10, 12, 24, 0.58), rgba(10, 12, 24, 0.18) 48%, rgba(10, 12, 24, 0.62)), linear-gradient(180deg, rgba(10, 12, 24, 0.58), rgba(10, 12, 24, 0.12) 42%, rgba(10, 12, 24, 0.68))",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-midnight-950/0"
      />
      {/* Hero */}
      <div className="text-center mb-12 drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
        <h1 className="font-fantasy text-5xl text-amber-300 mb-4 tracking-wider">
          AI Story Engine
        </h1>
        <p className="text-parchant-200 text-lg max-w-xl mx-auto leading-relaxed">
          输入你的故事创意，AI 自动生成完整的互动叙事世界。
          <br />
          多人角色扮演，动态规则引擎，AI 驱动的 NPC 与 GM。
          <br />
          每个选择都将改变故事的走向。
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {/* Create Story */}
        <button
          onClick={handleCreateStory}
          className="panel hover:border-amber-500/50 transition-all text-left group"
        >
          <div className="text-3xl mb-3">📖</div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-amber-300">
            创建故事
          </h3>
          <p className="text-parchant-500 text-sm">
            输入世界观、角色和结局设定，由 AI 为你生成完整的 Story Bible。
          </p>
        </button>

        {/* Quick Demo */}
        <button
          onClick={handleQuickDemo}
          className="panel hover:border-amber-500/50 transition-all text-left group"
        >
          <div className="text-3xl mb-3">🏰</div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2 group-hover:text-amber-300">
            Demo 故事
          </h3>
          <p className="text-parchant-500 text-sm">
            直接体验「失落圣杯之夜」——西幻权谋推理，4 个角色，多重结局。
          </p>
        </button>

        {/* Join Room */}
        <div className="panel text-left">
          <div className="text-3xl mb-3">🚪</div>
          <h3 className="font-fantasy text-amber-400 text-lg mb-2">加入房间</h3>
          <p className="text-parchant-500 text-sm mb-3">
            输入房间号和朋友一起游戏。
          </p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="你的名字"
            className="input-field text-sm mb-2"
          />
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="房间号 (6位)"
            maxLength={6}
            className="input-field text-sm mb-2"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!joinCode.trim() || !playerName.trim()}
            className="btn-primary text-sm w-full"
          >
            加入
          </button>
        </div>
      </div>

      {/* Feature list */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {[
          { icon: "🎭", label: "多人角色扮演" },
          { icon: "🧠", label: "AI GM 叙事" },
          { icon: "⚔️", label: "动态规则引擎" },
          { icon: "🗺️", label: "多重结局" },
        ].map((f) => (
          <div key={f.label} className="panel">
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-xs text-parchant-400">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
