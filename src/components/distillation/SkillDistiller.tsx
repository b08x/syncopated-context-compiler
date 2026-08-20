import React, { useState } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { useProvider } from '@/src/contexts/ProviderContext';
import { distillSkills } from '@/src/lib/distillation/orchestrator';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Zap, Loader2, FileText, Download } from 'lucide-react';

export function SkillDistiller() {
  const { state, dispatch } = useGraph();
  const { getProvider, apiKeys, taskConfigs } = useProvider();
  const [loading, setLoading] = useState<string | null>(null);

  const handleDistill = async (topicId: string) => {
    const weakConfig = taskConfigs.distillation_weak;
    const strongConfig = taskConfigs.distillation_strong;
    
    setLoading(topicId);
    try {
      const skills = await distillSkills(
        state, 
        getProvider, 
        apiKeys,
        weakConfig, 
        strongConfig, 
        topicId
      );
      dispatch({ type: 'ADD_SKILLS', payload: skills });
    } catch (err) {
      console.error(err);
      alert('Distillation failed. Check console for details.');
    } finally {
      setLoading(null);
    }
  };

  const topics = Object.keys(state.topics).length > 0 
    ? Object.keys(state.topics) 
    : Array.from(new Set((Object.values(state.trajectories) as any[]).map(t => 'default')));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Skill Distiller</h2>
        <p className="text-muted-foreground">Consolidate trajectory lessons into gitagent-compatible SKILL.md files.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Topic Clusters</h3>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No trajectories available for distillation. Compile trajectories first.</p>
          ) : (
            topics.map((topicId) => (
              <Card key={topicId} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-orange/30 transition-all">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-sm font-medium text-foreground">{state.topics[topicId]?.label || 'General Skills'}</CardTitle>
                  <Button 
                    onClick={() => handleDistill(topicId)}
                    disabled={loading !== null}
                    className="h-8 gap-2 bg-brand-orange text-brand-bg hover:bg-brand-orange/90 shadow-[0_0_10px_rgba(230,126,95,0.3)]"
                  >
                    {loading === topicId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Distill
                  </Button>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Distilled Skills</h3>
          {Object.values(state.skills).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No skills distilled yet.</p>
          ) : (
            (Object.values(state.skills) as any[]).map((skill) => (
              <Card key={skill.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-pink/30 transition-all">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-brand-pink" />
                    {skill.title}
                  </CardTitle>
                  <span className="text-[10px] font-mono text-muted-foreground">v{skill.version}</span>
                </CardHeader>
                <CardContent>
                  <pre className="text-[10px] bg-muted/30 p-3 rounded border border-border/50 overflow-auto max-h-40 font-mono text-muted-foreground scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    {skill.content.substring(0, 300)}...
                  </pre>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
