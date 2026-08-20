import React, { useState } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { createExecutor } from '@/src/lib/graph/query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Network, Play, Terminal, Box, BrainCircuit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Graph3D } from './Graph3D';
import { GraphInsights } from './GraphInsights';

export function GraphExplorer() {
  const { state } = useGraph();
  const [query, setQuery] = useState(`{
  conversations(rated: true) {
    id
    title
    rating {
      correctness
    }
  }
}`);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    const executor = createExecutor(state);
    const res = await executor.execute(query);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 h-full flex flex-col">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Graph Explorer</h2>
        <p className="text-muted-foreground">Query and visualize the in-memory ConvoGraph.</p>
      </div>

      <Tabs defaultValue="3d" className="flex-1 flex flex-col space-y-6 overflow-hidden">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 border border-border/50 p-1">
          <TabsTrigger value="3d" className="gap-2 data-[state=active]:bg-brand-orange data-[state=active]:text-brand-bg transition-all">
            <Box className="w-4 h-4" /> 3D Explorer
          </TabsTrigger>
          <TabsTrigger value="query" className="gap-2 data-[state=active]:bg-brand-pink data-[state=active]:text-brand-bg transition-all">
            <Terminal className="w-4 h-4" /> GraphQL Query
          </TabsTrigger>
        </TabsList>

        <TabsContent value="3d" className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
            <div className="xl:col-span-2 h-full min-h-[600px]">
              <Graph3D graph={state} />
            </div>
            <div className="h-full">
              <GraphInsights />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="query" className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
            <Card className="flex flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> GraphQL Query
                </CardTitle>
                <Button onClick={handleExecute} disabled={loading} className="h-8 gap-2 bg-brand-orange text-brand-bg hover:bg-brand-orange/90">
                  <Play className="w-3 h-3" /> Run
                </Button>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <textarea
                  className="w-full h-full p-6 font-mono text-sm bg-brand-bg text-foreground focus:outline-none resize-none border-t border-border/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Result</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-auto bg-muted/30 border-t border-border/50">
                <pre className="p-6 text-xs font-mono text-foreground/80">
                  {result ? JSON.stringify(result, null, 2) : 'No query executed yet.'}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
