import React from 'react';
import { Sidebar } from './Sidebar';
import { AIStatusIndicator } from './AIStatusIndicator';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background font-sans text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-12 shrink-0 border-b border-border/70 bg-card/40 backdrop-blur-xs px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">
              Conversation Intelligence & Skill Distillation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AIStatusIndicator />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
