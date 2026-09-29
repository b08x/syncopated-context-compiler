import React, { useState, useMemo } from 'react';
import { useMemoryStorage } from '@/src/hooks/useMemoryStorage';
import { MemoryNode, MemorySource } from '@/src/types/graph';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { 
  Brain, 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  Tag, 
  Clock, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileJson,
  Layers,
  Archive,
  Database
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function MemoryManager({ showHeader = true }: { showHeader?: boolean }) {
  const {
    memories,
    memoryCount,
    config,
    addMemory,
    deleteMemory,
    clearAllMemories,
    syncToExternal,
    syncFromExternal,
    isSyncing,
    syncStatus,
    exportMemories
  } = useMemoryStorage();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newSource, setNewSource] = useState<MemorySource>('user');

  // Source list
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => set.add(m.source));
    return Array.from(set);
  }, [memories]);

  // Filtered memories
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        m.content.toLowerCase().includes(q) ||
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q))) ||
        m.source.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
      return true;
    });
  }, [memories, search, sourceFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const tags = newTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    await addMemory({
      title: newTitle.trim() || undefined,
      content: newContent.trim(),
      source: newSource,
      tags
    });

    setNewTitle('');
    setNewContent('');
    setNewTags('');
    setIsAdding(false);
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'claude_memories':
        return 'bg-brand-orange/10 text-brand-orange border-brand-orange/30';
      case 'hindsight':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'user':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'custom':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-muted/70 text-foreground border-border/50';
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2.5">
              <Brain className="w-6 h-6 text-brand-orange" />
              Memory Workbench & Storage
            </h2>
            <p className="text-sm text-muted-foreground">
              User-defined memory storage, custom export formats (Markdown/Text/JSON), and external integration with services like Vectorize Hindsight.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs gap-1.5"
              onClick={() => setIsAdding(!isAdding)}
            >
              <Plus className="w-3.5 h-3.5 text-brand-orange" /> Add Memory
            </Button>
            
            {config.enabled && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs gap-1.5"
                  onClick={syncToExternal}
                  disabled={isSyncing}
                >
                  {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5 text-purple-500" />}
                  Push to {config.serviceType === 'hindsight' ? 'Hindsight' : 'Remote'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs gap-1.5"
                  onClick={syncFromExternal}
                  disabled={isSyncing}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                  Pull Remote
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className={cn(
          "p-3 rounded-xs border text-xs font-mono flex items-center justify-between gap-2",
          syncStatus.success 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
            : "bg-destructive/10 border-destructive/30 text-destructive"
        )}>
          <div className="flex items-center gap-2">
            {syncStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{syncStatus.message}</span>
          </div>
        </div>
      )}

      {/* Add Memory Form */}
      {isAdding && (
        <Card className="border-brand-orange/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono">
                <Sparkles className="w-4 h-4 text-brand-orange" /> Create User-Defined Memory
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-muted-foreground"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Directly persist a memory into the ConvoGraph and sync to configured storage targets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Title (Optional)</label>
                  <Input
                    placeholder="e.g. User Code Style Preferences"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Memory Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as MemorySource)}
                    className="w-full h-8 px-2 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono"
                  >
                    <option value="user">User Created (user)</option>
                    <option value="custom">Custom Entity (custom)</option>
                    <option value="hindsight">Vectorize Hindsight (hindsight)</option>
                    <option value="external">External API (external)</option>
                    <option value="claude_memories">Claude Memories</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Memory Content (Markdown supported)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter context, user preferences, agent guidelines, or factual memory..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-2.5 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Tags (Comma-separated)</label>
                <Input
                  placeholder="e.g. preferences, architecture, frontend, rules"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white font-mono text-xs">
                  Save Memory
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Control Bar: Search, Source Filter, Export Formats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-xs border border-border/50 text-xs font-mono">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search memories by content, title, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs font-mono bg-background/80"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-8 px-2 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono"
            >
              <option value="all">All Sources ({memories.length})</option>
              {availableSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1"
              onClick={() => exportMemories('markdown')}
              title="Export as Markdown (.md)"
            >
              <FileText className="w-3 h-3 text-brand-blue" /> .MD
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1"
              onClick={() => exportMemories('text')}
              title="Export as Plain Text (.txt)"
            >
              <FileText className="w-3 h-3 text-emerald-500" /> .TXT
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1"
              onClick={() => exportMemories('json')}
              title="Export as JSON (.json)"
            >
              <FileJson className="w-3 h-3 text-brand-orange" /> .JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1"
              onClick={() => exportMemories('all')}
              title="Export all memory files in a ZIP bundle"
            >
              <Archive className="w-3 h-3 text-purple-500" /> .ZIP
            </Button>
          </div>
        </div>
      </div>

      {/* Memory List */}
      {filteredMemories.length === 0 ? (
        <div className="p-8 text-center rounded-xs bg-muted/10 border border-border/30 text-xs font-mono text-muted-foreground space-y-3">
          <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p>
            {memories.length === 0 
              ? 'No memories recorded yet in ConvoWorkbench. Import a Claude export, connect to Hindsight, or click "Add Memory".' 
              : `No memories match the filter "${search || sourceFilter}".`}
          </p>
          {memories.length === 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              className="font-mono text-xs gap-1.5"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-3.5 h-3.5 text-brand-orange" /> Create First Memory
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredMemories.map((m, index) => {
            const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A';
            return (
              <Card key={m.id} className="border-border/60 bg-card/60 backdrop-blur-xs hover:border-border transition-all">
                <CardHeader className="p-3.5 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-xs font-mono">
                          {m.title || `Memory #${index + 1}`}
                        </span>

                        {/* Source Tag */}
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.2 rounded-xs border text-[10px] font-mono font-medium",
                          getSourceBadgeColor(m.source)
                        )}>
                          {m.source}
                        </span>

                        {/* External ID */}
                        {m.external_id && (
                          <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1 py-0.2 rounded-xs">
                            ext: {m.external_id.slice(0, 8)}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dateStr}
                        </span>
                        <span>&bull;</span>
                        <code>{m.id}</code>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMemory(m.id)}
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-2">
                  <div className="text-xs text-foreground font-sans leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-xs border border-border/30">
                    {m.content}
                  </div>

                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {m.tags.map(tag => (
                        <span 
                          key={tag} 
                          className="inline-flex items-center gap-1 text-[10px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-xs border border-border/40"
                        >
                          <Tag className="w-2.5 h-2.5 text-brand-orange" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
