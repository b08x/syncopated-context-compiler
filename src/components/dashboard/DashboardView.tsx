import React from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { MessageSquare, Network, Zap, CheckCircle2, AlertCircle, Upload, Database, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Link } from 'react-router-dom';

export function DashboardView() {
  const { state, isHydrated, isPersisting, lastSavedAt, storageStats } = useGraph();
  const stats = state.meta.stats;

  const cards = [
    { title: 'Conversations', value: stats.conversation_count, icon: MessageSquare, color: 'text-brand-orange' },
    { title: 'Messages', value: stats.message_count, icon: Network, color: 'text-brand-blue' },
    { title: 'Rated', value: stats.rated_count, icon: CheckCircle2, color: 'text-green-400' },
    { title: 'Skills Distilled', value: Object.keys(state.skills).length, icon: Zap, color: 'text-brand-orange' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your ConvoGraph, distillation progress, and local browser persistence.</p>
        </div>

        {/* Dexie.js Persistence Pill */}
        <Link 
          to="/settings" 
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-card hover:border-brand-orange/40 transition-all font-mono text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto cursor-pointer"
          title="Click to view Dexie.js storage settings"
        >
          <Database className="w-3.5 h-3.5 text-brand-orange" />
          <span>Dexie.js IndexedDB:</span>
          {isPersisting ? (
            <span className="text-brand-orange flex items-center gap-1 font-semibold">
              <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
            </span>
          ) : isHydrated ? (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Persistent
            </span>
          ) : (
            <span className="text-amber-500 font-semibold">Hydrating...</span>
          )}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.conversation_count === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data imported yet. Head to the Import tab.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Last import: {new Date(state.meta.imported_at).toLocaleString()}</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-brand-orange h-2 rounded-full transition-all shadow-[0_0_10px_rgba(230,126,95,0.5)]" 
                    style={{ width: `${stats.conversation_count > 0 ? (stats.rated_count / stats.conversation_count) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{stats.rated_count} of {stats.conversation_count} conversations rated</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2 border-border/50 hover:bg-brand-orange/10 hover:text-brand-orange hover:border-brand-orange/50 transition-all" asChild>
              <a href="/import"><Upload className="w-4 h-4" /> Import New Data</a>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-border/50 hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/50 transition-all" asChild>
              <a href="/review"><MessageSquare className="w-4 h-4" /> Continue Reviewing</a>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-border/50 hover:bg-brand-orange/10 hover:text-brand-orange hover:border-brand-orange/50 transition-all" asChild>
              <a href="/distill"><Zap className="w-4 h-4" /> Distill Skills</a>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-border/50 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/50 transition-all" asChild>
              <Link to="/settings"><Database className="w-4 h-4" /> Manage Dexie.js Storage ({storageStats?.conversations ?? 0} convos)</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
