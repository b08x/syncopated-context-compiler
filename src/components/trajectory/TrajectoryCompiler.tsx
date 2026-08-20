import React, { useState } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { useProvider } from '@/src/contexts/ProviderContext';
import { compileTrajectories, CompilationProgress } from '@/src/lib/trajectory/compiler';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Zap, Loader2, CheckCircle2, Clock, Network, Tag } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function TrajectoryCompiler() {
  const { state, dispatch } = useGraph();
  const { getProvider, apiKeys, taskConfigs } = useProvider();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [compilationLogs, setCompilationLogs] = useState<CompilationProgress[]>([]);

  const handleCompile = async () => {
    const config = taskConfigs.trajectory;
    const provider = getProvider(config.providerId);
    const apiKey = apiKeys[config.providerId];

    if (!provider) {
      // alert handled by provider logic usually, but let's be safe
    }
    
    setLoading(true);
    setCompilationLogs([]);
    setSuccess(false);
    
    try {
      const trajectories = await compileTrajectories(state, provider, apiKey, config, {}, (progress) => {
        setCompilationLogs(prev => [progress, ...prev]);
      });
      dispatch({ type: 'ADD_TRAJECTORIES', payload: trajectories });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Compilation failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const currentProgress = compilationLogs[0];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Trajectory Compiler</h2>
        <p className="text-muted-foreground">Group rated conversations into trajectories and extract lessons.</p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Compile Rated Traces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            This will analyze all rated conversations, group them by topic and quality, 
            and use the LLM to extract generalizable lessons.
          </p>
          
          {loading && currentProgress && (
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Network className="w-3 h-3" /> Compilation Progress
                </h4>
                {currentProgress.estimatedTimeRemaining !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ETR: {Math.ceil(currentProgress.estimatedTimeRemaining / 1000)}s
                  </span>
                )}
                {currentProgress.estimatedTimeRemaining === undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Processing...
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-pink transition-all duration-500 shadow-[0_0_10px_rgba(255,107,157,0.5)]" 
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (currentProgress.totalGroups > 0 ? (currentProgress.currentGroup / currentProgress.totalGroups) * 100 : 0)))}%` 
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  Group {currentProgress.currentGroup} / {currentProgress.totalGroups}
                </span>
              </div>

              <div className="text-xs text-muted-foreground italic">
                Currently analyzing: <span className="font-semibold text-brand-orange">{currentProgress.groupLabel}</span>
              </div>
            </div>
          )}

          <Button 
            className="w-full h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(230,126,95,0.2)]" 
            onClick={handleCompile} 
            disabled={loading || (Object.values(state.conversations) as any[]).filter(c => c.rating).length === 0}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Compiling Trajectories...' : 'Start Compilation'}
          </Button>

          {success && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 p-3 rounded-md border border-green-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Trajectories compiled! Head to Distill to generate skills.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Compiled Trajectories</h3>
        {Object.values(state.trajectories).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No trajectories compiled yet.</p>
        ) : (
          <div className="grid gap-4">
            {(Object.values(state.trajectories) as any[]).map((t) => (
              <Card key={t.id} className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden group hover:border-brand-orange/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-[10px] font-mono uppercase px-2 py-0.5 rounded shadow-[0_0_8px_currentColor]",
                      t.quality_signal === 'positive' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    )}>
                      {t.quality_signal}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{t.conversation_ids.length} traces</span>
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-3 whitespace-pre-wrap italic leading-relaxed">{t.lesson}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
