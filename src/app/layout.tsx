import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Story Engine",
  description: "AI-driven interactive multiplayer storytelling",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.12),transparent_34%),linear-gradient(180deg,#17192b,#202338_48%,#151728)]">
        <header className="sticky top-0 z-50 border-b border-midnight-500/60 bg-midnight-950/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <a href="/" className="font-fantasy text-xl tracking-wider text-amber-300 transition-colors hover:text-amber-200">
              AI Story Engine
            </a>
            <nav className="flex gap-4 text-sm text-parchment-300">
              <a href="/" className="transition-colors hover:text-amber-300">首页</a>
              <a href="/generate" className="transition-colors hover:text-amber-300">生成故事</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

