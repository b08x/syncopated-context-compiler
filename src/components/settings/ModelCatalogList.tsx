import React, { useState, useMemo } from 'react';
import { ModelInfo } from '@/src/types/provider';
import { Switch } from '@/src/components/ui/switch';
import { Input } from '@/src/components/ui/input';
import { 
  Cpu, 
  Search, 
  ArrowUpDown, 
  DollarSign, 
  Maximize2, 
  Zap, 
  Check, 
  SlidersHorizontal,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ModelCatalogListProps {
  providerId: string;
  models: ModelInfo[];
  isModelEnabled: (providerId: string, modelId: string) => boolean;
  setModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void;
}

type SortOption = 'default' | 'context-desc' | 'context-asc' | 'price-asc' | 'price-desc' | 'name';

export function ModelCatalogList({
  providerId,
  models,
  isModelEnabled,
  setModelEnabled,
}: ModelCatalogListProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [filterFeature, setFilterFeature] = useState<string>('all');
  const isOpenRouter = providerId === 'openrouter';

  // Compute available features across current provider's models
  const allFeatures = useMemo(() => {
    const set = new Set<string>();
    models.forEach(m => {
      m.features?.forEach(f => set.add(f));
      if (m.capabilities.tools) set.add('Function Calling');
      if (m.capabilities.reasoning) set.add('Reasoning');
      if (m.capabilities.structured) set.add('Structured JSON');
      if (m.capabilities.vision) set.add('Vision');
    });
    return Array.from(set);
  }, [models]);

  // Filter and sort models
  const processedModels = useMemo(() => {
    let result = models.filter(m => {
      const q = search.toLowerCase();
      const matchesSearch = !q || 
        m.name.toLowerCase().includes(q) || 
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterFeature !== 'all') {
        const hasFeature = m.features?.includes(filterFeature) ||
          (filterFeature === 'Function Calling' && m.capabilities.tools) ||
          (filterFeature === 'Reasoning' && m.capabilities.reasoning) ||
          (filterFeature === 'Structured JSON' && m.capabilities.structured) ||
          (filterFeature === 'Vision' && m.capabilities.vision);
        if (!hasFeature) return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'context-desc') {
        return (b.contextLength || 0) - (a.contextLength || 0);
      }
      if (sortBy === 'context-asc') {
        return (a.contextLength || 0) - (b.contextLength || 0);
      }
      if (sortBy === 'price-asc') {
        const priceA = (a.pricing?.prompt || 0) + (a.pricing?.completion || 0);
        const priceB = (b.pricing?.prompt || 0) + (b.pricing?.completion || 0);
        return priceA - priceB;
      }
      if (sortBy === 'price-desc') {
        const priceA = (a.pricing?.prompt || 0) + (a.pricing?.completion || 0);
        const priceB = (b.pricing?.prompt || 0) + (b.pricing?.completion || 0);
        return priceB - priceA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [models, search, sortBy, filterFeature]);

  const formatContext = (ctx?: number) => {
    if (!ctx) return 'Unknown ctx';
    if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 === 0 ? 0 : 1)}M ctx`;
    if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}k ctx`;
    return `${ctx} ctx`;
  };

  const formatPrice = (price?: { prompt: number; completion: number }) => {
    if (!price || (price.prompt === 0 && price.completion === 0)) {
      return 'Free / Local';
    }
    return `$${price.prompt.toFixed(2)} / $${price.completion.toFixed(2)} per 1M`;
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Search, Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/20 p-2 rounded-xs border border-border/40 text-xs font-mono">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by model name, ID, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs bg-background/80 border-border/50 font-mono"
          />
        </div>

        {/* Feature quick filter */}
        {allFeatures.length > 0 && (
          <select
            value={filterFeature}
            onChange={(e) => setFilterFeature(e.target.value)}
            className="h-7 px-2.5 rounded-xs border border-border/60 bg-background text-foreground text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange"
          >
            <option value="all">All Features ({models.length})</option>
            {allFeatures.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-7 px-2.5 rounded-xs border border-border/60 bg-background text-foreground text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange"
          >
            <option value="default">Default Order</option>
            <option value="context-desc">Context: Largest First</option>
            <option value="context-asc">Context: Smallest First</option>
            <option value="price-asc">Price: Lowest First</option>
            <option value="price-desc">Price: Highest First</option>
            <option value="name">Model Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Model Cards Grid */}
      {processedModels.length === 0 ? (
        <div className="p-6 text-center rounded-xs bg-muted/10 border border-border/30 text-xs font-mono text-muted-foreground">
          No models matching &ldquo;{search}&rdquo; with the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {processedModels.map(m => {
            const modelActive = isModelEnabled(providerId, m.id);
            const contextStr = formatContext(m.contextLength);
            const pricingStr = formatPrice(m.pricing);

            return (
              <div
                key={m.id}
                className={cn(
                  "p-3 rounded-xs border text-xs font-mono transition-all duration-150 flex flex-col gap-2",
                  modelActive 
                    ? "bg-card border-border/70 shadow-xs" 
                    : "bg-muted/20 border-border/30 opacity-70 hover:opacity-95"
                )}
              >
                {/* Header row: Name, ID, Context badge, Price badge, Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-xs font-mono tracking-tight">
                        {m.name}
                      </span>

                      {/* Context Window Tag */}
                      {m.contextLength && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-xs border font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                          <Maximize2 className="w-2.5 h-2.5" />
                          {contextStr}
                        </span>
                      )}

                      {/* Pricing Tag */}
                      {m.pricing && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-xs border font-mono font-medium",
                          m.pricing.prompt === 0 && m.pricing.completion === 0
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        )}>
                          <DollarSign className="w-2.5 h-2.5" />
                          {pricingStr}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground/80 font-mono truncate">
                      <code>{m.id}</code>
                      {m.maxOutputTokens && (
                        <span className="ml-2 text-muted-foreground/60">
                          &bull; max output: {m.maxOutputTokens.toLocaleString()} tokens
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Enable Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground select-none">
                      {modelActive ? 'Enabled' : 'Off'}
                    </span>
                    <Switch
                      checked={modelActive}
                      onCheckedChange={(checked) => setModelEnabled(providerId, m.id, checked)}
                      size="sm"
                      aria-label={`Toggle model ${m.name}`}
                    />
                  </div>
                </div>

                {/* Description if available */}
                {m.description && (
                  <p className="text-[11px] text-muted-foreground font-sans line-clamp-2 leading-relaxed">
                    {m.description}
                  </p>
                )}

                {/* Features & Supported Parameters Section */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/30">
                  {/* Model Capabilities & Features */}
                  {m.features && m.features.length > 0 ? (
                    m.features.map(f => (
                      <span 
                        key={f} 
                        className="text-[9px] px-1.5 py-0.5 rounded-xs bg-muted/60 text-foreground border border-border/50 font-mono flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-brand-orange" />
                        {f}
                      </span>
                    ))
                  ) : (
                    <>
                      {m.capabilities.tools && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-muted/60 text-foreground border border-border/50 font-mono">
                          Function Calling
                        </span>
                      )}
                      {m.capabilities.reasoning && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-muted/60 text-foreground border border-border/50 font-mono">
                          Reasoning
                        </span>
                      )}
                      {m.capabilities.structured && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-muted/60 text-foreground border border-border/50 font-mono">
                          Structured JSON
                        </span>
                      )}
                    </>
                  )}

                  {/* OpenRouter specific: Supported Parameters pills */}
                  {isOpenRouter && m.supportedParameters && m.supportedParameters.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap ml-auto">
                      <span className="text-[9px] text-muted-foreground/70 font-mono flex items-center gap-0.5">
                        <SlidersHorizontal className="w-2.5 h-2.5" /> params:
                      </span>
                      {m.supportedParameters.slice(0, 5).map(param => (
                        <span
                          key={param}
                          className="text-[8px] font-mono px-1 py-0.2 rounded-xs bg-background/80 text-muted-foreground border border-border/40"
                          title={`Supported parameter: ${param}`}
                        >
                          {param}
                        </span>
                      ))}
                      {m.supportedParameters.length > 5 && (
                        <span className="text-[8px] font-mono text-muted-foreground/60">
                          +{m.supportedParameters.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
