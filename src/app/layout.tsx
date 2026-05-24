import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Story Foundry",
  description: "AI-driven interactive multiplayer storytelling",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-midnight-950 bg-star-pattern bg-noise relative">
        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-40 w-96 h-96 bg-amber-600/3 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl" />
        </div>

        <header className="relative border-b border-midnight-700/50 bg-midnight-900/70 backdrop-blur-xl sticky top-0 z-50 shadow-glow-amber-sm">
          <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <a
              href="/"
              className="font-fantasy text-xl text-amber-400 tracking-[0.2em] hover:text-amber-300 transition-colors flex items-center gap-3"
            >
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-midnight-900 text-sm font-bold shadow-glow-amber-sm">
                S
              </span>
              AI Story Foundry
            </a>
            <nav className="flex gap-1 text-sm">
              <a href="/" className="btn-ghost text-parchment-300">首页</a>
              <a href="/generate" className="btn-ghost text-parchment-300">生成故事</a>
            </nav>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
