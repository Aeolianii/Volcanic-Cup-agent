import type { Metadata } from "next";
import "./globals.css";
import { AtmosphereBackground } from "@/components/ui/AtmosphereBackground";
import { AppHeader } from "@/components/ui/AppHeader";

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
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-midnight-950">
        <AtmosphereBackground />

        <div className="relative z-10 flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-midnight-800/50 py-6 text-center text-xs text-parchment-600">
            <p>AI Story Engine &mdash; Powered by AI, Crafted with Imagination</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
