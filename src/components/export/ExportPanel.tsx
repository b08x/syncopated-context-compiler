import React, { useState } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { 
  Download, 
  FileJson, 
  Archive, 
  FileText, 
  Brain, 
  Sparkles, 
  Layers, 
  Settings, 
  CheckCircle2 
} from 'lucide-react';
import { 
  downloadExportZip, 
  formatMemoriesAsMarkdown, 
  formatMemoriesAsPlainText, 
  formatMemoriesAsJson,
  MemoryExportFormat 
} from '@/src/output/zip';
import { Link } from 'react-router-dom';

export function ExportPanel() {
  const { state } = useGraph();
  const memoriesList = Object.values(state.memories || {});
  const [selectedMemoryFormat, setSelectedMemoryFormat] = useState<MemoryExportFormat>('markdown');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRawText = (content: string, filename: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      await downloadExportZip(state, {
        memoryOptions: {
          format: selectedMemoryFormat,
          organization: 'both',
          includeMetadata: true
        },
        includeSkills: true,
        includeTrajectories: true,
        includeRatings: true,
        includeGraphJson: true
      }, 'convo-workbench-export.zip');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2.5">
            <Archive className="w-6 h-6 text-brand-orange" />
            Export Artifacts & Memories
          </h2>
          <p className="text-sm text-muted-foreground">
            Download your distilled agent skills, rated ConvoGraph, and memories in customizable export formats.
          </p>
        </div>

        <Link to="/settings" className="text-xs font-mono text-muted-foreground hover:text-brand-orange flex items-center gap-1.5 self-start sm:self-auto">
          <Settings className="w-3.5 h-3.5" /> Memory Storage Settings &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Bundle (ZIP) */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 font-mono">
              <Archive className="w-5 h-5 text-brand-orange" />
              Full Bundle (ZIP)
            </CardTitle>
            <CardDescription className="text-xs">
              Includes gitagent-compatible <code className="font-mono text-brand-orange">skills/</code> directory, custom memory exports, full graph snapshot, and conversation ratings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Memory Export Format selector */}
            <div className="space-y-1.5 p-3 rounded-xs bg-muted/20 border border-border/50">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Include Memories ({memoriesList.length}) in format:
              </label>
              <select
                value={selectedMemoryFormat}
                onChange={(e) => setSelectedMemoryFormat(e.target.value as MemoryExportFormat)}
                className="w-full h-8 px-2.5 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono"
              >
                <option value="markdown">Markdown (.md) - memories.md + items/*.md</option>
                <option value="text">Plain Text (.txt) - memories.txt</option>
                <option value="json">Structured JSON (.json) - memories.json</option>
                <option value="all">All Formats (Markdown, Text, JSON)</option>
              </select>
            </div>

            <Button 
              className="w-full gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-mono text-xs" 
              onClick={handleDownloadZip}
              disabled={isExportingZip}
            >
              <Download className="w-4 h-4" /> 
              {isExportingZip ? 'Packaging Zip Archive...' : 'Download convo-workbench-export.zip'}
            </Button>
          </CardContent>
        </Card>

        {/* Custom Memory Standalone Exports */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 font-mono">
              <Brain className="w-5 h-5 text-purple-400" />
              Direct Memory Exports ({memoriesList.length} items)
            </CardTitle>
            <CardDescription className="text-xs">
              Download memory records directly in your preferred user-defined format without archiving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 font-mono text-xs h-9 hover:border-brand-blue/50 hover:bg-brand-blue/5"
              onClick={() => downloadRawText(formatMemoriesAsMarkdown(memoriesList), 'memories.md', 'text/markdown')}
              disabled={memoriesList.length === 0}
            >
              <FileText className="w-4 h-4 text-brand-blue" />
              <span>memories.md</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Formatted Markdown</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 font-mono text-xs h-9 hover:border-emerald-500/50 hover:bg-emerald-500/5"
              onClick={() => downloadRawText(formatMemoriesAsPlainText(memoriesList), 'memories.txt', 'text/plain')}
              disabled={memoriesList.length === 0}
            >
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>memories.txt</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Plain Text</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 font-mono text-xs h-9 hover:border-brand-orange/50 hover:bg-brand-orange/5"
              onClick={() => downloadRawText(formatMemoriesAsJson(memoriesList), 'memories.json', 'application/json')}
              disabled={memoriesList.length === 0}
            >
              <FileJson className="w-4 h-4 text-brand-orange" />
              <span>memories.json</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Structured JSON</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* JSON Snapshots */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 font-mono">
            <FileJson className="w-5 h-5 text-brand-orange" />
            Raw JSON Snapshots
          </CardTitle>
          <CardDescription className="text-xs">
            Directly download unbundled JSON snapshots of individual ConvoGraph subtrees.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <Button variant="outline" className="justify-start gap-2 font-mono text-xs h-9" onClick={() => downloadJson(state, 'graph.json')}>
            <Download className="w-3.5 h-3.5 text-brand-orange" /> graph.json
          </Button>
          <Button variant="outline" className="justify-start gap-2 font-mono text-xs h-9" onClick={() => downloadJson(state.trajectories, 'trajectories.json')}>
            <Download className="w-3.5 h-3.5 text-brand-blue" /> trajectories.json
          </Button>
          <Button variant="outline" className="justify-start gap-2 font-mono text-xs h-9" onClick={() => downloadJson(state.skills, 'skills.json')}>
            <Download className="w-3.5 h-3.5 text-emerald-500" /> skills.json
          </Button>
          <Button variant="outline" className="justify-start gap-2 font-mono text-xs h-9" onClick={() => downloadJson(memoriesList, 'memories.json')}>
            <Download className="w-3.5 h-3.5 text-purple-400" /> memories.json
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
