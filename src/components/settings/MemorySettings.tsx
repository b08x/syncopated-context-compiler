import React, { useState } from 'react';
import { useMemoryStorage } from '@/src/hooks/useMemoryStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { Label } from '@/src/components/ui/label';
import { 
  Brain, 
  Database, 
  ExternalLink, 
  Server, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FileJson, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft,
  Sparkles,
  Sliders,
  Code
} from 'lucide-react';
import { MemoryManager } from '../memory/MemoryManager';
import { cn } from '@/src/lib/utils';
import { MemoryExportFormat, MemoryStorageMode, ExternalServiceType } from '@/src/lib/memory/external_service';

export function MemorySettings() {
  const {
    config,
    updateConfig,
    testConnection,
    isTesting,
    testResult,
    syncToExternal,
    syncFromExternal,
    isSyncing,
    syncStatus,
    memoryCount,
    exportMemories
  } = useMemoryStorage();

  const [showKey, setShowKey] = useState(false);

  const handleModeChange = (mode: MemoryStorageMode) => {
    updateConfig({ storageMode: mode, enabled: mode !== 'dexie' });
  };

  const handleServiceTypeChange = (type: ExternalServiceType) => {
    updateConfig({ 
      serviceType: type,
      endpointUrl: type === 'hindsight' && config.endpointUrl === 'http://localhost:8080/v1/memory'
        ? 'http://localhost:8080/v1/memory' 
        : config.endpointUrl 
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 font-mono">
            <Brain className="w-5 h-5 text-brand-orange" />
            User-Defined Memory Storage Architecture
          </CardTitle>
          <CardDescription className="text-xs">
            Configure how ConvoWorkbench stores, formats, and synchronizes agent memories across local Dexie IndexedDB and external services like Vectorize Hindsight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Storage Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground">
              Storage Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Local Dexie */}
              <div
                onClick={() => handleModeChange('dexie')}
                className={cn(
                  "p-3.5 rounded-xs border cursor-pointer transition-all flex flex-col justify-between gap-2",
                  config.storageMode === 'dexie'
                    ? "border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange"
                    : "border-border/50 bg-background/50 hover:border-border"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground font-mono">
                    <Database className="w-4 h-4 text-brand-orange" />
                    Local Dexie (IndexedDB)
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Private in-browser persistence. Instant client-side indexing and offline access.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-brand-orange uppercase font-bold">
                  {config.storageMode === 'dexie' ? 'Active' : 'Select'}
                </span>
              </div>

              {/* Hybrid Mode */}
              <div
                onClick={() => handleModeChange('hybrid')}
                className={cn(
                  "p-3.5 rounded-xs border cursor-pointer transition-all flex flex-col justify-between gap-2",
                  config.storageMode === 'hybrid'
                    ? "border-purple-500 bg-purple-500/5 ring-1 ring-purple-500"
                    : "border-border/50 bg-background/50 hover:border-border"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground font-mono">
                    <Layers className="w-4 h-4 text-purple-500" />
                    Hybrid (Local + Sync)
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Stores locally in Dexie IndexedDB and broadcasts/synchronizes with an external memory service.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-purple-500 uppercase font-bold">
                  {config.storageMode === 'hybrid' ? 'Active' : 'Select'}
                </span>
              </div>

              {/* Remote Service */}
              <div
                onClick={() => handleModeChange('external')}
                className={cn(
                  "p-3.5 rounded-xs border cursor-pointer transition-all flex flex-col justify-between gap-2",
                  config.storageMode === 'external'
                    ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                    : "border-border/50 bg-background/50 hover:border-border"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground font-mono">
                    <Server className="w-4 h-4 text-emerald-500" />
                    External Service
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Direct integration with Vectorize Hindsight or external memory endpoints.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold">
                  {config.storageMode === 'external' ? 'Active' : 'Select'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* External Service Integration Panel */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 font-mono">
              <Server className="w-4 h-4 text-purple-500" />
              External Service Configuration (Vectorize Hindsight / REST)
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">Enable Sync:</span>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Connect ConvoWorkbench to self-hosted Hindsight (<a href="https://github.com/vectorize-io/hindsight" target="_blank" rel="noreferrer" className="text-brand-orange underline inline-flex items-center gap-0.5">github.com/vectorize-io/hindsight <ExternalLink className="w-2.5 h-2.5" /></a>) or any external agent memory API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Service Protocol</label>
              <select
                value={config.serviceType}
                onChange={(e) => handleServiceTypeChange(e.target.value as ExternalServiceType)}
                className="w-full h-8 px-2.5 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono"
              >
                <option value="hindsight">Vectorize Hindsight (v1/memory)</option>
                <option value="generic_rest">Generic REST API / Webhook</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Bank ID / Namespace</label>
              <Input
                placeholder="e.g. agent-workspace or default"
                value={config.bankId || ''}
                onChange={(e) => updateConfig({ bankId: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">API Endpoint URL</label>
            <Input
              placeholder="e.g. http://localhost:8080/v1/memory or https://api.vectorize.io/v1/memory"
              value={config.endpointUrl}
              onChange={(e) => updateConfig({ endpointUrl: e.target.value })}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground font-mono">
              Calls are routed through the backend proxy (/api/memory/*) to guarantee zero CORS failures.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Auth Token / API Key (Optional)</label>
              <button 
                type="button" 
                onClick={() => setShowKey(!showKey)}
                className="text-[10px] text-muted-foreground hover:text-foreground font-mono"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="Bearer token or API key if service is authenticated"
              value={config.apiKey || ''}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xs bg-muted/20 border border-border/40">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground block">Auto-Sync on Memory Creation</span>
              <span className="text-[11px] text-muted-foreground">
                Automatically push newly added memories to external service.
              </span>
            </div>
            <Switch
              checked={config.autoSyncOnAdd ?? false}
              onCheckedChange={(checked) => updateConfig({ autoSyncOnAdd: checked })}
            />
          </div>

          {/* Test & Sync Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1.5"
              onClick={testConnection}
              disabled={isTesting}
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
              Test Connection
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1.5"
              onClick={syncToExternal}
              disabled={isSyncing || !config.enabled}
            >
              {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5 text-purple-500" />}
              Push ({memoryCount}) Memories
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1.5"
              onClick={syncFromExternal}
              disabled={isSyncing || !config.enabled}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
              Pull Remote Memories
            </Button>

            {testResult && (
              <span className={cn(
                "inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-xs border ml-auto",
                testResult.success 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                  : "bg-destructive/10 text-destructive border-destructive/30"
              )}>
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {testResult.message} {testResult.latencyMs && `(${testResult.latencyMs}ms)`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Export Formats Configuration */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 font-mono">
            <FileText className="w-4 h-4 text-brand-orange" />
            Custom Memory Export Formats
          </CardTitle>
          <CardDescription className="text-xs">
            Specify how memories are structured and exported in standalone files and full workbench ZIP archives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Default Export Format</label>
              <select
                value={config.exportFormat || 'markdown'}
                onChange={(e) => updateConfig({ exportFormat: e.target.value as MemoryExportFormat })}
                className="w-full h-8 px-2.5 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono"
              >
                <option value="markdown">Markdown (.md) - Formatted with Headers & Tags</option>
                <option value="text">Plain Text (.txt) - Delimited Records</option>
                <option value="json">Structured JSON (.json) - Full Array</option>
                <option value="jsonl">JSON Lines (.jsonl) - Streaming / Line By Line</option>
                <option value="all">All Formats (.zip bundle)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Quick Export Action</label>
              <div className="flex items-center gap-2 pt-0.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs font-mono flex-1 gap-1"
                  onClick={() => exportMemories(config.exportFormat || 'markdown')}
                >
                  <FileText className="w-3.5 h-3.5 text-brand-orange" />
                  Export as {(config.exportFormat || 'markdown').toUpperCase()}
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Template Editor */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-brand-orange" />
                Custom Markdown Export Template
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Variables: &#123;&#123;title&#125;&#125;, &#123;&#123;content&#125;&#125;, &#123;&#123;source&#125;&#125;, &#123;&#123;date&#125;&#125;, &#123;&#123;tags&#125;&#125;, &#123;&#123;tags_section&#125;&#125;, &#123;&#123;id&#125;&#125;
              </span>
            </div>
            <textarea
              rows={4}
              value={config.customTemplate || ''}
              onChange={(e) => updateConfig({ customTemplate: e.target.value })}
              className="w-full p-2.5 rounded-xs border border-border/70 bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange"
              placeholder="# {{title}}\n- **Source:** {{source}}\n- **Date:** {{date}}\n{{tags_section}}\n\n{{content}}"
            />
          </div>
        </CardContent>
      </Card>

      {/* Memory Manager View inside Settings */}
      <div className="pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider font-mono text-muted-foreground mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-brand-orange" /> Stored Memories ({memoryCount})
        </h3>
        <MemoryManager showHeader={false} />
      </div>
    </div>
  );
}
