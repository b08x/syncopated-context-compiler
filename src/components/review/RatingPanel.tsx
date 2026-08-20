import React, { useState, useEffect } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { ConversationRating } from '@/src/types/graph';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { 
  Check, X, ThumbsUp, ThumbsDown, FileText, AlertCircle, 
  Minus, Hash, MessageSquare, Zap, Ghost, Smile, RefreshCw
} from 'lucide-react';

interface RatingPanelProps {
  conversationId: string | null;
}

const STYLE_OPTIONS = [
  { id: 'too_long', label: 'Too Long', icon: Hash },
  { id: 'too_concise', label: 'Too Concise', icon: MessageSquare },
  { id: 'sycophantic', label: 'Sycophantic', icon: Smile },
  { id: 'caustic', label: 'Caustic', icon: Zap },
  { id: 'repetitive', label: 'Repetitive', icon: RefreshCw },
  { id: 'hallucination', label: 'Hallucination', icon: Ghost },
];

export function RatingPanel({ conversationId }: RatingPanelProps) {
  const { state, dispatch } = useGraph();
  const conversation = conversationId ? state.conversations[conversationId] : null;

  const [rating, setRating] = useState<Partial<ConversationRating>>({
    style_tags: []
  });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (conversation) {
      setRating(conversation.rating || { style_tags: [] });
      setNotes(conversation.notes || '');
    }
  }, [conversationId, conversation]);

  const INTENTS = [
    { id: 'refactor', label: 'Code Refactor' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'debugging', label: 'Debugging' },
    { id: 'research', label: 'Research' },
    { id: 'config', label: 'Config' }
  ] as const;

  const DISTILLABLE = [
    { id: 'yes', label: 'Yes' },
    { id: 'maybe', label: 'Needs editing' },
    { id: 'no', label: 'No' }
  ] as const;

  const DOMAINS = [
    { id: 'agent', label: 'Agent Config' },
    { id: 'serialization', label: 'Serialization' },
    { id: 'prompt', label: 'Prompt Eng.' },
    { id: 'tooling', label: 'Tooling' },
    { id: 'other', label: 'Other' }
  ] as const;

  const updateRating = (updates: Partial<ConversationRating>) => {
    const newRating = { 
      ...rating, 
      ...updates,
      style_tags: updates.style_tags || rating.style_tags || [],
      rated_at: Date.now()
    } as ConversationRating;
    
    setRating(newRating);
    if (conversationId) {
      dispatch({
        type: 'UPDATE_CONVERSATION_RATING',
        payload: { id: conversationId, rating: newRating, notes }
      });
    }
  };

  const toggleStyleTag = (tag: string) => {
    const currentTags = rating.style_tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    updateRating({ style_tags: newTags });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    if (conversationId) {
      dispatch({
        type: 'UPDATE_CONVERSATION_RATING',
        payload: { id: conversationId, rating: rating as ConversationRating, notes: e.target.value }
      });
    }
  };

  if (!conversation) return null;

  return (
    <div className="w-[450px] border-l border-border bg-card flex flex-col h-full scrollbar-none">
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-12 custom-scrollbar">
        {/* Rating Controls */}
        <section className="space-y-8">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Rating Controls</h3>
          
          <div className="space-y-6">
            {/* Correctness */}
            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Correctness</label>
              <div className="flex gap-1">
                {[
                  { id: 'correct', label: '✓ Correct' },
                  { id: 'neutral', label: '— N/A' },
                  { id: 'fail', label: '✕ Fail' }
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "flex-1 h-8 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm border border-transparent",
                      rating.correctness === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ correctness: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tone</label>
              <div className="flex gap-1">
                {[
                  { id: 'good', label: '↑ Good' },
                  { id: 'neutral', label: '— N/A' },
                  { id: 'issues', label: '↓ Issues' }
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "flex-1 h-8 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm border border-transparent",
                      rating.tone === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ tone: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Format</label>
              <div className="flex gap-1">
                {[
                  { id: 'good', label: 'Good' },
                  { id: 'neutral', label: '— N/A' },
                  { id: 'bad', label: 'Bad' }
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "flex-1 h-8 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm border border-transparent",
                      rating.format === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ format: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Style Tags */}
            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Style Tags</label>
              <div className="grid grid-cols-2 gap-1">
                {STYLE_OPTIONS.map((opt) => {
                  const isActive = rating.style_tags?.includes(opt.id);
                  return (
                    <Button
                      key={opt.id}
                      variant="ghost"
                      className={cn(
                        "h-8 text-[10px] font-bold uppercase tracking-widest justify-start px-3 rounded-sm border border-transparent transition-all",
                        isActive 
                          ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      onClick={() => toggleStyleTag(opt.id)}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Context */}
        <section className="space-y-8">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Context</h3>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Primary intent?</label>
              <div className="flex flex-wrap gap-1">
                {INTENTS.map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "h-7 text-[9px] font-bold uppercase tracking-widest rounded-sm px-2 border border-transparent transition-all",
                      rating.intent === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ intent: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Distillable into SKILL.md?</label>
              <div className="flex gap-1">
                {DISTILLABLE.map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "flex-1 h-7 text-[9px] font-bold uppercase tracking-widest rounded-sm border border-transparent transition-all",
                      rating.distillable === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ distillable: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Skill relevance</label>
                <span className="text-[10px] font-mono text-brand-orange font-bold tracking-tight">{(!rating.relevance || isNaN(Number(rating.relevance))) ? 0 : Number(rating.relevance)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={(!rating.relevance || isNaN(Number(rating.relevance))) ? 0 : Number(rating.relevance)}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateRating({ relevance: isNaN(val) ? 0 : val });
                }}
                className="w-full accent-brand-orange h-1.5 bg-background border border-border rounded-sm appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Skill domain</label>
              <div className="flex flex-wrap gap-1">
                {DOMAINS.map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    className={cn(
                      "h-7 text-[9px] font-bold uppercase tracking-widest rounded-sm px-2 border border-transparent transition-all",
                      rating.domain === opt.id 
                        ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => updateRating({ domain: opt.id as any })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Notes</label>
              <textarea
                className="w-full h-32 px-4 py-4 text-[11px] bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-orange/40 text-foreground placeholder:text-muted-foreground/30 resize-none transition-all font-mono leading-relaxed"
                placeholder="Add annotations or failure analysis..."
                value={notes}
                onChange={handleNotesChange}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="p-8 border-t border-border bg-muted">
        <div className="flex justify-between items-center text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">
          <span>Shortcuts</span>
          <div className="flex gap-4">
            <span className="text-brand-orange/60">1-6</span>
            <span className="text-muted-foreground/30">← →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
