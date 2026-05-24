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
      <body className="min-h-screen bg-gradient-to-b from-midnight-900 via-midnight-800 to-midnight-900">
        <header className="border-b border-midnight-600 bg-midnight-900/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-fantasy text-xl text-amber-500 tracking-wider">
              AI Story Engine
            </a>
            <nav className="flex gap-4 text-sm text-parchant-300">
              <a href="/" className="hover:text-amber-400 transition-colors">首页</a>
              <a href="/generate" className="hover:text-amber-400 transition-colors">生成故事</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
