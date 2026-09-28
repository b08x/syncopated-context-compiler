import React, { useState } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { useProvider } from '@/src/contexts/ProviderContext';
import { useDatabase } from '@/src/hooks/useDatabase';
import { parseClaudeExport, parseChatGPTExport, parseMistralExport } from '@/src/lib/graph/builder';
import { parseMarkdownExport } from '@/src/lib/graph/markdown_parser';
import { extractTopics, TopicExtractionProgress } from '@/src/lib/graph/topic_extraction';
import { ConversationNode, ConvoGraph } from '@/src/types/graph';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { 
  FileJson, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Network, 
  Clock, 
  Tag, 
  Database,
  ArrowRight,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Label } from '@/src/components/ui/label';
import { cn } from '@/src/lib/utils';

export type ImportSource = 'claude' | 'chatgpt' | 'mistral' | 'markdown';

interface UploadedFileRecord {
  name: string;
  size: number;
  content: string;
}

export function ImportWizard() {
  const { dispatch, refreshStorageStats } = useGraph();
  const { getProvider, apiKeys, taskConfigs } = useProvider();
  
  // Directly bind useDatabase hook to manage Dexie persistence and import session records
  const { saveGraph, setItem, db } = useDatabase();

  const [source, setSource] = useState<ImportSource | null>(null);
  const [files, setFiles] = useState<Record<string, UploadedFileRecord[]>>({});
  const [status, setStatus] = useState<'idle' | 'parsing' | 'saving_db' | 'extracting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    conversations: number;
    messages: number;
    source: string;
    dexiePersisted: boolean;
  } | null>(null);
  const [shouldExtractTopics, setShouldExtractTopics] = useState(false);
  const [topicLogs, setTopicLogs] = useState<TopicExtractionProgress[]>([]);

  const handleFileChange = (key: string, fileList: FileList) => {
    const newFiles: UploadedFileRecord[] = [];
    let processed = 0;
    
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        newFiles.push({
          name: file.name,
          size: file.size,
          content,
        });
        processed++;
        if (processed === fileList.length) {
          setFiles(prev => ({ ...prev, [key]: [...(prev[key] || []), ...newFiles] }));
        }
      };
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    setStatus('parsing');
    setTopicLogs([]);
    setError(null);
    setImportSummary(null);

    try {
      if (!files['conversations'] || files['conversations'].length === 0) {
        throw new Error('At least one conversations export file (JSON or Markdown) is required');
      }

      let finalGraph: ConvoGraph | null = null;

      const mergeGraphs = (base: ConvoGraph | null, incoming: ConvoGraph): ConvoGraph => {
        if (!base) return incoming;
        const merged: ConvoGraph = {
          ...base,
          messages: { ...base.messages, ...incoming.messages },
          conversations: { ...base.conversations, ...incoming.conversations },
          topics: { ...base.topics, ...incoming.topics },
          trajectories: { ...base.trajectories, ...incoming.trajectories },
          skills: { ...base.skills, ...incoming.skills },
          memories: { ...base.memories, ...incoming.memories },
          artifacts: { ...base.artifacts, ...incoming.artifacts },
          project_docs: { ...base.project_docs, ...incoming.project_docs },
          meta: {
            ...base.meta,
            imported_at: Date.now(),
            stats: {
              ...base.meta.stats,
              message_count: Object.keys({ ...base.messages, ...incoming.messages }).length,
              conversation_count: Object.keys({ ...base.conversations, ...incoming.conversations }).length,
              topic_count: Object.keys({ ...base.topics, ...incoming.topics }).length,
              skill_count: Object.keys({ ...base.skills, ...incoming.skills }).length,
              artifact_count: Object.keys({ ...base.artifacts, ...incoming.artifacts }).length,
              project_doc_count: Object.keys({ ...base.project_docs, ...incoming.project_docs }).length,
              rated_count: Object.values({ ...base.conversations, ...incoming.conversations }).filter(c => c.rating !== null).length,
            }
          }
        };
        return merged;
      };

      for (let i = 0; i < files['conversations'].length; i++) {
        const fileObj = files['conversations'][i];
        const contentStr = fileObj.content;
        let currentGraph: ConvoGraph;
        
        if (source === 'claude') {
          currentGraph = parseClaudeExport(
            contentStr, 
            files['projects']?.[i]?.content, 
            files['memories']?.[i]?.content
          );
        } else if (source === 'chatgpt') {
          currentGraph = parseChatGPTExport(contentStr);
        } else if (source === 'mistral') {
          currentGraph = parseMistralExport(contentStr);
        } else if (source === 'markdown') {
          currentGraph = parseMarkdownExport(contentStr, fileObj.name);
        } else {
          // Auto-detect JSON vs Markdown if source is generic
          if (contentStr.trim().startsWith('{') || contentStr.trim().startsWith('[')) {
            try {
              currentGraph = parseChatGPTExport(contentStr);
            } catch {
              currentGraph = parseClaudeExport(contentStr);
            }
          } else {
            currentGraph = parseMarkdownExport(contentStr, fileObj.name);
          }
        }
        
        finalGraph = mergeGraphs(finalGraph, currentGraph);
      }

      if (!finalGraph || Object.keys(finalGraph.conversations).length === 0) {
        throw new Error('No valid conversations could be extracted from the provided files.');
      }

      // Optional LLM Topic Extraction
      if (shouldExtractTopics && finalGraph) {
        setStatus('extracting');
        const config = taskConfigs.import;
        const provider = getProvider(config.providerId);
        const apiKey = apiKeys[config.providerId];
        
        if (provider) {
          const conversations = Object.values(finalGraph.conversations).slice(0, 100) as ConversationNode[];
          const topics = await extractTopics(conversations, provider, apiKey, config, (progress) => {
            setTopicLogs(prev => [progress, ...prev]);
          });
          topics.forEach(t => {
            if (finalGraph) finalGraph.topics[t.id] = t;
          });
          finalGraph.meta.stats.topic_count = Object.keys(finalGraph.topics).length;
        }
      }

      // Explicitly persist imported graph into Dexie IndexedDB via useDatabase hook
      setStatus('saving_db');
      await saveGraph(finalGraph);

      // Save an audit session log into Dexie's sessions table via useDatabase.setItem
      await setItem(`last_import_batch_${Date.now()}`, {
        source: source || 'auto',
        fileCount: files['conversations'].length,
        filenames: files['conversations'].map(f => f.name),
        conversationCount: Object.keys(finalGraph.conversations).length,
        messageCount: Object.keys(finalGraph.messages).length,
        importedAt: Date.now(),
      }, 'import_history');

      // Update in-memory graph state (with skipPersist=true since useDatabase already saved to Dexie directly)
      dispatch({ type: 'SET_GRAPH', payload: finalGraph, skipPersist: true });
      await refreshStorageStats();

      setImportSummary({
        conversations: Object.keys(finalGraph.conversations).length,
        messages: Object.keys(finalGraph.messages).length,
        source: source ? source.toUpperCase() : 'AUTO-PARSED',
        dexiePersisted: true,
      });

      setStatus('success');
    } catch (err) {
      console.error('Import failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown import error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          Import Conversations
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-sm border border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
            Dexie.js Persistent
          </span>
        </h2>
        <p className="text-muted-foreground text-sm">
          Parse and normalize JSON or Markdown transcripts from ChatGPT, Claude, Mistral, or standard markdown files and save them directly into Dexie IndexedDB.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Claude Option */}
        <Card 
          className={cn(
            "cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-orange/50",
            source === 'claude' && "border-brand-orange ring-1 ring-brand-orange bg-brand-orange/5"
          )}
          onClick={() => setSource('claude')}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-6 h-6 rounded bg-brand-orange flex items-center justify-center text-brand-bg text-[10px] font-bold">C</div>
              Claude.ai
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">JSON export with conversations, projects & memories.</p>
          </CardContent>
        </Card>

        {/* ChatGPT Option */}
        <Card 
          className={cn(
            "cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-green/50",
            source === 'chatgpt' && "border-brand-green ring-1 ring-brand-green bg-brand-green/5"
          )}
          onClick={() => setSource('chatgpt')}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-6 h-6 rounded bg-brand-green flex items-center justify-center text-white text-[10px] font-bold">G</div>
              ChatGPT
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">JSON data export from OpenAI account settings.</p>
          </CardContent>
        </Card>

        {/* Mistral Option */}
        <Card 
          className={cn(
            "cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-orange/50",
            source === 'mistral' && "border-brand-orange ring-1 ring-brand-orange bg-brand-orange/5"
          )}
          onClick={() => setSource('mistral')}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-6 h-6 rounded bg-[#f3d060] flex items-center justify-center text-black text-[10px] font-bold">M</div>
              Mistral LeChat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">JSON message logs from Mistral LeChat exports.</p>
          </CardContent>
        </Card>

        {/* Markdown Option */}
        <Card 
          className={cn(
            "cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm hover:border-brand-blue/50",
            source === 'markdown' && "border-brand-blue ring-1 ring-brand-blue bg-brand-blue/5"
          )}
          onClick={() => setSource('markdown')}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-6 h-6 rounded bg-brand-blue flex items-center justify-center text-white text-[10px] font-bold">
                <FileText className="w-3.5 h-3.5" />
              </div>
              Markdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">.md files with User/Assistant dialogue markers.</p>
          </CardContent>
        </Card>
      </div>

      {source && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Upload {source.toUpperCase()} Transcripts</span>
              <span className="text-[11px] font-sans font-normal text-muted-foreground">
                IndexedDB storage powered by <code className="font-mono text-brand-orange">useDatabase()</code>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center justify-between">
                  <span>
                    {source === 'markdown' ? 'Markdown Files (.md, .markdown, .txt)' : 'Conversations Export File (.json)'} (Required)
                  </span>
                  {files['conversations']?.length > 0 && (
                    <span className="text-xs font-mono text-emerald-500 flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> {files['conversations'].length} file(s) ready
                    </span>
                  )}
                </label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="file" 
                    accept={source === 'markdown' ? '.md,.markdown,.txt' : '.json,.md,.markdown,.txt'}
                    multiple
                    onChange={(e) => e.target.files && handleFileChange('conversations', e.target.files)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all cursor-pointer font-mono"
                  />
                  {files['conversations']?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {files['conversations'].map((f, idx) => (
                        <span key={idx} className="text-[11px] font-mono bg-muted/60 text-foreground px-2 py-0.5 rounded border border-border/50 flex items-center gap-1">
                          {source === 'markdown' ? <FileText className="w-3 h-3 text-brand-blue" /> : <FileJson className="w-3 h-3 text-brand-orange" />}
                          {f.name} ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {source === 'claude' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">projects.json (Optional)</label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file" 
                        accept=".json"
                        multiple
                        onChange={(e) => e.target.files && handleFileChange('projects', e.target.files)}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80 transition-all font-mono"
                      />
                      {files['projects']?.length > 0 && (
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
                          <FileJson className="w-3 h-3" /> {files['projects'].length} projects file(s) selected
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">memories.json (Optional)</label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file" 
                        accept=".json"
                        multiple
                        onChange={(e) => e.target.files && handleFileChange('memories', e.target.files)}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80 transition-all font-mono"
                      />
                      {files['memories']?.length > 0 && (
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
                          <FileJson className="w-3 h-3" /> {files['memories'].length} memories file(s) selected
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="extract-topics" 
                  checked={shouldExtractTopics}
                  onCheckedChange={(checked) => setShouldExtractTopics(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="extract-topics" className="text-sm font-medium text-foreground">
                    Extract Topics using LLM
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uses the model configured for "Conversation Import" in Settings.
                  </p>
                </div>
              </div>
            </div>

            {topicLogs.length > 0 && (
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Network className="w-3 h-3" /> Extraction Progress
                  </h4>
                  {topicLogs[0]?.estimatedTimeRemaining !== undefined && (
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ETR: {Math.ceil(topicLogs[0].estimatedTimeRemaining / 1000)}s
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-orange transition-all duration-500 shadow-[0_0_10px_rgba(230,126,95,0.5)]" 
                      style={{ 
                        width: `${Math.min(100, Math.max(0, (topicLogs[0].totalBatches > 0 ? (topicLogs[0].currentBatch / topicLogs[0].totalBatches) * 100 : 0)))}%` 
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    Batch {topicLogs[0].currentBatch} / {topicLogs[0].totalBatches}
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {topicLogs.filter(log => log.topic).map((log, i) => (
                    <div key={i} className="text-xs border-l-2 border-brand-blue/50 pl-3 py-1 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-mono text-[10px] uppercase text-brand-blue">Topic Extracted</span>
                      </div>
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <Tag className="w-3 h-3 text-brand-orange" />
                        {log.topic?.label}
                      </div>
                      <div className="text-muted-foreground italic">
                        {log.convoTitles?.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(230,126,95,0.2)] font-mono text-xs" 
              disabled={status === 'parsing' || status === 'saving_db' || status === 'extracting' || !files['conversations']}
              onClick={handleImport}
            >
              {(status === 'parsing' || status === 'saving_db' || status === 'extracting') ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {status === 'parsing' ? 'Parsing JSON/Markdown...' : status === 'saving_db' ? 'Writing to Dexie IndexedDB...' : 'Extracting Topics...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Build & Save to Dexie IndexedDB
                </span>
              )}
            </Button>

            {status === 'success' && importSummary && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>ConvoGraph parsed and stored into Dexie IndexedDB successfully!</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                  <div className="p-2 rounded bg-background/60 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground uppercase">Conversations</span>
                    <div className="text-base font-bold text-foreground">{importSummary.conversations.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded bg-background/60 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground uppercase">Messages</span>
                    <div className="text-base font-bold text-foreground">{importSummary.messages.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded bg-background/60 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground uppercase">Storage Engine</span>
                    <div className="text-base font-bold text-emerald-500 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5" /> IndexedDB
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Transcripts are now ready for rating, trajectory distillation, and graph exploration across all application tabs.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
