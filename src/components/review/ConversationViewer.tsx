import * as React from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { useProvider } from '@/src/contexts/ProviderContext';
import { TaskType } from '@/src/types/provider';
import { cn } from '@/src/lib/utils';
import { 
  MessageSquare, User, Bot, Clock, Tag, CheckSquare, 
  Square, Sparkles, Search, X, Loader2, Copy, FileText,
  Code, Layers, Info
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ConversationViewerProps {
  conversationId: string | null;
}

export function ConversationViewer({ conversationId }: ConversationViewerProps) {
  const { state, dispatch } = useGraph();
  const { getProvider, apiKeys, taskConfigs } = useProvider();
  const conversation = conversationId ? state.conversations[conversationId] : null;
  
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [actionResult, setActionResult] = React.useState<{ type: 'summary' | 'search' | 'replace', content: string, providerName?: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingText, setLoadingText] = React.useState('Analyzing');

  const verbs = ['Synthesizing', 'Distilling', 'Analyzing', 'Retrieving', 'Contextualizing', 'Extracting'];

  const getTaskConfig = (task: TaskType) => {
    return taskConfigs[task] || { providerId: 'google', modelId: 'gemini-3-flash-preview', parameters: { temperature: 0.1, maxTokens: 1000 } };
  };

  React.useEffect(() => {
    let interval: any;
    if (loading) {
      let i = 0;
      interval = setInterval(() => {
        setLoadingText(verbs[i % verbs.length]);
        i++;
      }, 800);
    } else {
      setLoadingText('Analyzing');
    }
    return () => clearInterval(interval);
  }, [loading]);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    // If clicking a selection dot or specific indicator, handle it, 
    // but here we toggle on click of the whole message
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setActionResult(null);
  };

  const selectAll = () => {
    if (!conversation) return;
    setSelectedIds(new Set(conversation.messages));
  };

  const selectUser = () => {
    if (!conversation) return;
    const userIds = conversation.messages.filter(mId => state.messages[mId].role === 'user');
    setSelectedIds(new Set(userIds));
  };

  const selectAssistant = () => {
    if (!conversation) return;
    const assistantIds = conversation.messages.filter(mId => state.messages[mId].role === 'assistant');
    setSelectedIds(new Set(assistantIds));
  };

  const handleSummarize = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const config = getTaskConfig('summary');
      const provider = getProvider(config.providerId);
      if (!provider) throw new Error(`${config.providerId} provider not found`);

      const selectedMessages = Array.from(selectedIds)
        .map(id => state.messages[id])
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const prompt = {
        system: "You are a concise summarizer. Summarize the following conversation snippet. Focus on key decisions, insights, or technical details. Use Markdown.",
        user: selectedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
      };

      const result = await provider.generate(prompt, apiKeys[config.providerId], config.modelId);
      setActionResult({ type: 'summary', content: result.text, providerName: provider.name });
    } catch (err) {
      console.error(err);
      setActionResult({ type: 'summary', content: `Error: ${err instanceof Error ? err.message : 'Failed to summarize'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAndReplace = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const config = getTaskConfig('refactor');
      const provider = getProvider(config.providerId);
      if (!provider) throw new Error(`${config.providerId} provider not found`);

      const selectedText = Array.from(selectedIds)
        .map(id => state.messages[id].content)
        .join('\n---\n');

      const prompt = {
        system: "You are a precision refactoring assistant. Based on the selected text, identify technical terms, aliases, or patterns that should be consistently replaced or standardized. Suggest a list of 'Search and Replace' pairs. Output in Markdown.",
        user: `Selected Text:\n${selectedText}`
      };

      const result = await provider.generate(prompt, apiKeys[config.providerId], config.modelId);
      setActionResult({ type: 'replace', content: result.text, providerName: provider.name });
    } catch (err) {
      console.error(err);
      setActionResult({ type: 'replace', content: `Error: ${err instanceof Error ? err.message : 'Failed to generate replacement suggestions'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySuggestions = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const config = getTaskConfig('search');
      const provider = getProvider(config.providerId);
      if (!provider) throw new Error(`${config.providerId} provider not found`);

      const selectedMessages = Array.from(selectedIds)
        .map(id => state.messages[id])
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const prompt = {
        system: "You are a retrieval expert. Analyze the provided conversation snippet and suggest 5-8 precise search queries that would help a user find related documents, similar technical problems, or relevant documentation in a knowledge base. Output as a bulleted list in Markdown.",
        user: selectedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
      };

      const result = await provider.generate(prompt, apiKeys[config.providerId], config.modelId);
      setActionResult({ type: 'search', content: result.text, providerName: provider.name });
    } catch (err) {
      console.error(err);
      setActionResult({ type: 'search', content: `Error: ${err instanceof Error ? err.message : 'Failed to generate queries'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToNotes = () => {
    if (!conversationId || !actionResult) return;
    
    const currentNotes = conversation?.notes || '';
    const headerMap = {
      summary: '### AI Summary',
      search: '### Search Terms',
      replace: '### Refactor Recommendations'
    };
    const header = headerMap[actionResult.type];
    const newNotes = currentNotes 
      ? `${currentNotes}\n\n${header}\n${actionResult.content}`
      : `${header}\n${actionResult.content}`;

    dispatch({
      type: 'UPDATE_CONVERSATION_RATING',
      payload: { 
        id: conversationId, 
        rating: conversation?.rating || null, 
        notes: newNotes 
      }
    });
    setActionResult(null);
    clearSelection();
  };

  const [viewFilter, setViewFilter] = React.useState<'all' | 'user' | 'assistant'>('all');

  const filteredMessages = React.useMemo(() => {
    if (!conversation) return [];
    if (viewFilter === 'all') return conversation.messages;
    return conversation.messages.filter(mId => state.messages[mId].role === (viewFilter === 'assistant' ? 'assistant' : viewFilter));
  }, [conversation, viewFilter, state.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground/20">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-6 opacity-10" />
          <p className="font-mono uppercase tracking-[0.3em] text-[10px]">Select Node to Inspect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="p-8 border-b border-border bg-card flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground leading-tight truncate">{conversation.title || 'Untitled Conversation'}</h2>
          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest font-bold">View:</span>
              <div className="flex gap-2">
                {(['all', 'user', 'assistant'] as const).map((v) => (
                  <button
                    key={`view-${v}`}
                    onClick={() => setViewFilter(v)}
                    className={cn(
                      "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-all border border-transparent",
                      viewFilter === v ? "text-brand-orange bg-brand-orange/10 border-brand-orange/20 rounded-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === 'assistant' ? 'MODEL' : v}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest font-bold">Select:</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-brand-orange hover:bg-brand-orange/5 transition-all"
                >
                  All
                </button>
                <button
                  onClick={selectUser}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-brand-orange hover:bg-brand-orange/5 transition-all"
                >
                  User
                </button>
                <button
                  onClick={selectAssistant}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-brand-orange hover:bg-brand-orange/5 transition-all"
                >
                  Model
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-sm">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
              {conversation.messages.length} MSGS
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-12 space-y-12 custom-scrollbar">
        {filteredMessages.map((mId) => {
          const message = state.messages[mId];
          if (!message) return null;
          const isUser = message.role === 'user';
          const isSelected = selectedIds.has(mId);

          return (
            <div 
              key={mId} 
              className={cn(
                "max-w-4xl group relative transition-all cursor-pointer",
                isSelected && "bg-brand-orange/[0.03] -mx-8 px-8 rounded-sm ring-1 ring-brand-orange/10"
              )}
              onClick={(e) => toggleSelection(mId, e)}
            >
              <div className="space-y-4">
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2",
                  isUser ? "text-brand-blue" : "text-brand-orange"
                )}>
                  {isUser ? 'USER' : 'ASSISTANT'}
                  {isSelected && <span className="h-1 w-1 rounded-full bg-brand-orange animate-pulse" />}
                </div>
                <div className="text-sm leading-relaxed text-foreground font-sans selection:bg-brand-orange/30 whitespace-pre-wrap">
                  <MessageContent 
                    content={message.content} 
                    artifactIds={message.artifact_ids} 
                    artifacts={state.artifacts} 
                  />
                </div>
              </div>
            </div>
          );
        })}

        {Object.values(state.artifacts).filter(a => a.conversation_id === conversationId).length > 0 && (
          <div className="max-w-4xl pt-12 pb-24 border-t border-border">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-8 flex items-center gap-2 font-bold">
              <Layers className="w-3 h-3" /> Extracted Artifacts
            </h3>
            <div className="grid gap-6">
              {Object.values(state.artifacts)
                .filter(a => a.conversation_id === conversationId)
                .map(artifact => (
                  <Card key={artifact.id} className="border-border bg-card rounded-sm overflow-hidden group hover:border-brand-orange/20 transition-all">
                    <div className="p-6 flex items-start gap-6">
                      <div className="w-12 h-12 rounded-sm bg-muted flex items-center justify-center text-muted-foreground group-hover:text-brand-orange transition-colors">
                        {artifact.type === 'code' ? <Code className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[9px] font-mono font-bold uppercase text-brand-orange/80 bg-brand-orange/5 px-2 py-0.5 rounded-sm tracking-widest border border-brand-orange/10">
                            {artifact.type}
                          </span>
                          {artifact.language && (
                            <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground tracking-widest">
                              {artifact.language}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-foreground mb-6 font-mono tracking-tight">
                          {artifact.title || 'Untitled Artifact'}
                        </h4>
                        <div className="bg-background border border-border rounded-sm p-6 overflow-hidden">
                          <div className="max-h-96 overflow-y-auto custom-scrollbar">
                            <div className="text-xs font-mono leading-relaxed text-foreground/80">
                              <ReactMarkdown>
                                {artifact.type === 'code' ? `\`\`\`${artifact.language || ''}\n${artifact.content}\n\`\`\`` : artifact.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end mt-6">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] font-bold uppercase tracking-widest gap-2 h-8 px-4 hover:bg-muted"
                            onClick={() => navigator.clipboard.writeText(artifact.content)}
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <Card className="bg-card backdrop-blur-md border-brand-orange shadow-2xl p-2 flex items-center gap-2">
              <div className="px-4 border-r border-border mr-2">
                <span className="text-xs font-mono text-brand-orange">{selectedIds.size} Selected</span>
              </div>
              <Button 
                variant="ghost" 
                className="gap-2 text-xs text-foreground hover:bg-brand-orange/10 hover:text-brand-orange h-8"
                onClick={handleSummarize}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {loading ? `${loadingText}...` : 'Summarize'}
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2 text-xs text-foreground hover:bg-brand-green/10 hover:text-brand-green h-8"
                onClick={handleSearchAndReplace}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code className="w-3 h-3" />}
                {loading ? `${loadingText}...` : 'Search & Replace'}
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2 text-xs text-foreground hover:bg-brand-orange/10 hover:text-brand-orange h-8"
                onClick={handleQuerySuggestions}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {loading ? `${loadingText}...` : 'Search Queries'}
              </Button>
              <Button 
                variant="ghost" 
                className="gap-2 text-xs text-muted-foreground hover:text-foreground h-8"
                onClick={clearSelection}
              >
                <X className="w-3 h-3" />
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[60] bg-background/80 backdrop-blur-sm p-12 flex items-center justify-center"
          >
            <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col border-brand-orange bg-card shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center bg-muted">
                <h3 className="text-sm font-mono uppercase tracking-wider text-brand-orange flex items-center gap-2">
                  {actionResult.type === 'summary' ? <Sparkles className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                  {actionResult.providerName ? `${actionResult.providerName} ` : ''}
                  {actionResult.type === 'summary' ? 'AI Summary' : actionResult.type === 'search' ? 'Search Terms' : 'Search & Replace suggestions'}
                </h3>
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setActionResult(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-6 prose prose-stone prose-sm max-w-none text-foreground">
                <ReactMarkdown>{actionResult.content}</ReactMarkdown>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted">
                <Button 
                  variant="outline" 
                  className="text-xs gap-2 h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(actionResult.content);
                  }}
                >
                  <Copy className="w-3 h-3" /> Copy
                </Button>
                <Button 
                  className="text-xs bg-brand-green text-white hover:bg-brand-green/90 h-8"
                  onClick={handleSaveToNotes}
                >
                  <FileText className="w-3 h-3" /> Save to Notes
                </Button>
                <Button 
                  className="text-xs bg-brand-orange text-white hover:bg-brand-orange/90 h-8"
                  onClick={() => setActionResult(null)}
                >
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageContent({ content, artifactIds, artifacts }: { content: string, artifactIds?: string[], artifacts: Record<string, import('@/src/types/graph').ArtifactNode> }) {
  if (!artifactIds || artifactIds.length === 0) return <div className="whitespace-pre-wrap">{content}</div>;

  const relevantArtifacts = artifactIds.map(id => artifacts[id]).filter(Boolean);
  if (relevantArtifacts.length === 0) return <div className="whitespace-pre-wrap">{content}</div>;

  // Sort by length descending to match longer strings first and prevent partial matches within matches
  const sortedArtifacts = [...relevantArtifacts].sort((a, b) => b.content.length - a.content.length);

  let parts: { text: string, artifact?: any }[] = [{ text: content }];

  sortedArtifacts.forEach(artifact => {
    const newParts: typeof parts = [];
    parts.forEach(part => {
      if (part.artifact) {
        newParts.push(part);
        return;
      }

      // Split text by artifact content, preserving the content
      // We use a simple split for now. In a more robust version, we'd handle regex escaping.
      const segments = part.text.split(artifact.content);
      segments.forEach((segment, i) => {
        if (segment) newParts.push({ text: segment });
        if (i < segments.length - 1) {
          newParts.push({ text: artifact.content, artifact });
        }
      });
    });
    parts = newParts;
  });

  return (
    <div className="whitespace-pre-wrap font-sans">
      {parts.map((part, i) => (
        part.artifact ? (
          <span 
            key={i} 
            className="inline-block bg-brand-orange/5 border border-brand-orange/20 rounded px-1 -mx-0.5 text-brand-orange/90 font-mono text-[0.95em] shadow-[0_0_15px_rgba(230,126,95,0.05)] cursor-default transition-all hover:bg-brand-orange/10 hover:border-brand-orange/40"
            title={`Artifact: ${part.artifact.title || part.artifact.type}`}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      ))}
    </div>
  );
}
