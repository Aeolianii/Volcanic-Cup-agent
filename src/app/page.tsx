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
    <div className="relative left-1/2 isolate -my-6 flex min-h-[calc(100vh-3.25rem)] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden px-4 py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-30 bg-top bg-no-repeat"
        style={{
          backgroundImage: "url('/images/home-background.png')",
          backgroundSize: "100% auto",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(90deg, rgba(8, 10, 22, 0.72), rgba(8, 10, 22, 0.28) 48%, rgba(8, 10, 22, 0.74)), linear-gradient(180deg, rgba(8, 10, 22, 0.42), rgba(8, 10, 22, 0.16) 42%, rgba(8, 10, 22, 0.82))",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-20 h-1/2 bg-gradient-to-b from-transparent via-midnight-900/70 to-midnight-900"
      />

      <section className="w-full max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
            AI powered roleplay engine
          </p>
          <h1 className="font-fantasy text-4xl tracking-wide text-amber-200 sm:text-6xl">
            AI Story Engine
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-parchment-100/90 sm:text-lg">
            输入故事创意，生成完整互动叙事世界。选择角色、推进线索、结算行动，让每一次决定都改变故事走向。
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          <button
            onClick={handleCreateStory}
            className="panel interactive-card group relative min-h-[240px] overflow-hidden border-amber-500/30 bg-gradient-to-br from-midnight-800/90 via-midnight-800/78 to-midnight-900/92 text-left"
          >
            <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-transform duration-300 group-hover:scale-125" />
            <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-500/8 to-transparent" />
            <div className="relative flex h-full flex-col">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/15 text-2xl text-amber-100 shadow-[0_10px_30px_rgba(217,119,6,0.15)] transition-transform duration-200 group-hover:scale-105">
                ✦
              </span>
              <div className="mb-5 inline-flex w-fit rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/90">
                推荐入口
              </div>
              <h2 className="section-title mb-3 text-2xl transition-colors group-hover:text-amber-100">
                创建故事
              </h2>
              <p className="max-w-sm text-sm leading-6 text-parchment-300">
                从题材、开场、人物关系和世界观开始，由 AI 生成可游玩的 Story Bible。
              </p>
              <div className="mt-auto flex items-center gap-2 pt-6 text-sm text-amber-200/90 transition-transform duration-200 group-hover:translate-x-1">
                <span className="font-medium">开始构建</span>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </button>

          <button
            onClick={handleQuickDemo}
            className="panel interactive-card group relative min-h-[240px] overflow-hidden border-cyan-400/25 bg-gradient-to-br from-midnight-800/90 via-midnight-800/80 to-midnight-900/92 text-left"
          >
            <span className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl transition-transform duration-300 group-hover:scale-125" />
            <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyan-400/8 to-transparent" />
            <div className="relative flex h-full flex-col">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-2xl text-cyan-100 shadow-[0_10px_30px_rgba(34,211,238,0.12)] transition-transform duration-200 group-hover:scale-105">
                ▶
              </span>
              <div className="mb-5 inline-flex w-fit rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/90">
                一键体验
              </div>
              <h2 className="section-title mb-3 text-2xl transition-colors group-hover:text-cyan-100">
                Demo 故事
              </h2>
              <p className="max-w-sm text-sm leading-6 text-parchment-300">
                直接进入一段多角色推理故事，快速体验 GM 叙事、线索与多结局流程。
              </p>
              <div className="mt-auto flex items-center gap-2 pt-6 text-sm text-cyan-100/90 transition-transform duration-200 group-hover:translate-x-1">
                <span className="font-medium">立即试玩</span>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </button>

          <div className="panel flex min-h-[240px] flex-col text-left">
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-midnight-300/30 bg-midnight-500/25 text-2xl text-parchment-100">
              #
            </span>
            <h2 className="section-title mb-3 text-2xl">加入房间</h2>
            <p className="mb-4 text-sm leading-6 text-parchment-300">
              输入你的名字和房间号，回到朋友已经创建好的故事。
            </p>
            <div className="mt-auto space-y-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="你的名字"
                className="input-field text-sm"
              />
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="房间号（6位）"
                maxLength={6}
                className="input-field text-sm tracking-widest"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!joinCode.trim() || !playerName.trim()}
                className="btn-primary w-full text-sm"
              >
                加入
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center md:grid-cols-4">
          {[
            { label: "多人角色扮演", accent: "border-amber-400/30" },
            { label: "AI GM 叙事", accent: "border-cyan-300/30" },
            { label: "动态规则结算", accent: "border-emerald-300/30" },
            { label: "多重结局", accent: "border-rose-300/30" },
          ].map((feature) => (
            <div key={feature.label} className={`panel border ${feature.accent} px-3 py-3`}>
              <p className="text-xs font-medium text-parchment-300">{feature.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
