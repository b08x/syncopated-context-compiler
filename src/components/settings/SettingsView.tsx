import React, { useState, useEffect } from 'react';
import { useProvider } from '@/src/contexts/ProviderContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Label } from '@/src/components/ui/label';
import { Slider } from '@/src/components/ui/slider';
import { Switch } from '@/src/components/ui/switch';
import { 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw, 
  Settings2, 
  Key, 
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  Sliders
} from 'lucide-react';
import { TaskType } from '@/src/types/provider';
import { cn } from '@/src/lib/utils';

const TASK_LABELS: Record<TaskType, string> = {
  import: 'Conversation Import',
  review: 'Review & Rating',
  trajectory: 'Trajectory Compiler',
  distillation_weak: 'Skill Distiller (Weak Agent)',
  distillation_strong: 'Skill Distiller (Strong Agent)',
  retrieval: 'Search & Retrieval',
  insights: 'Graph Insights',
  summary: 'Node & Chat Summaries',
  refactor: 'Refactor Recommendations',
  search: 'Query Suggestions',
};

export function SettingsView() {
  const { 
    providers, 
    enabledProviders,
    setProviderEnabled,
    disabledModels,
    setModelEnabled,
    isModelEnabled,
    apiKeys,
    setApiKey,
    taskConfigs, 
    setTaskConfig,
    availableModels, 
    refreshModels,
    serverKeyStatus,
    testConnection,
    testResults
  } = useProvider();

  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('providers');

  useEffect(() => {
    // Initial fetch of models for providers with keys
    providers.forEach(p => {
      refreshModels(p.id);
    });
  }, []);

  const toggleExpand = (providerId: string) => {
    setExpandedModels(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    await testConnection(providerId);
    setTestingId(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-brand-orange" />
            AI Engine & Provider Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Granularly enable individual AI providers, manage API credentials, test connections, and toggle specific models.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-muted/40 border border-border/60 p-1">
          <TabsTrigger 
            value="providers" 
            className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-brand-orange transition-all font-mono text-xs uppercase tracking-wider"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Modular AI Providers
          </TabsTrigger>
          <TabsTrigger 
            value="tasks" 
            className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-brand-orange transition-all font-mono text-xs uppercase tracking-wider"
          >
            <Settings2 className="w-4 h-4 text-brand-orange" /> Task Model Routing
          </TabsTrigger>
        </TabsList>

        {/* MODULAR AI PROVIDERS TAB */}
        <TabsContent value="providers" className="space-y-6">
          <div className="grid gap-4">
            {providers.map((p) => {
              const isEnabled = Boolean(enabledProviders[p.id]);
              const isServerKeyed = Boolean(serverKeyStatus[p.id]);
              const clientKey = apiKeys[p.id] || '';
              const isConfigured = isServerKeyed || Boolean(clientKey) || p.id === 'ollama';
              const models = availableModels[p.id] || [];
              const testResult = testResults[p.id];
              const isExpanded = Boolean(expandedModels[p.id]);
              const isTesting = testingId === p.id;

              return (
                <Card 
                  key={p.id} 
                  className={cn(
                    "border transition-all duration-200 bg-card/60 backdrop-blur-xs",
                    isEnabled 
                      ? "border-brand-orange/40 shadow-xs" 
                      : "border-border/60 opacity-80 hover:opacity-100"
                  )}
                >
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Provider Title & Badges */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full shrink-0 transition-colors",
                          isEnabled ? "bg-brand-orange shadow-[0_0_8px_rgba(230,126,95,0.6)]" : "bg-muted-foreground/30"
                        )} />
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold text-foreground">
                              {p.name}
                            </CardTitle>
                            
                            {/* Provider Enablement Status */}
                            <span className={cn(
                              "text-[10px] font-mono px-2 py-0.5 rounded-xs uppercase tracking-wider font-bold border",
                              isEnabled 
                                ? "bg-brand-orange/15 text-brand-orange border-brand-orange/30" 
                                : "bg-muted text-muted-foreground border-border"
                            )}>
                              {isEnabled ? 'Provider Active' : 'Disabled (Default)'}
                            </span>

                            {/* Credentials Status */}
                            {isConfigured ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-xs flex items-center gap-1 font-mono font-medium">
                                <ShieldCheck className="w-3 h-3" />
                                {isServerKeyed ? 'Server Key' : p.id === 'ollama' ? 'Local Daemon' : 'Client Key'}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-xs flex items-center gap-1 font-mono font-medium">
                                <AlertCircle className="w-3 h-3" />
                                Key Needed
                              </span>
                            )}
                          </div>

                          <CardDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {models.length} discovered models &bull; ID: <code>{p.id}</code>
                          </CardDescription>
                        </div>
                      </div>

                      {/* Header Actions: Test Connection + Toggle Switch */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Test Connection Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isTesting}
                          onClick={() => handleTest(p.id)}
                          className={cn(
                            "h-8 gap-1.5 text-xs font-mono border-border/80 hover:border-brand-orange/50 hover:bg-brand-orange/10 hover:text-brand-orange transition-colors cursor-pointer",
                            isTesting && "opacity-80"
                          )}
                          title="Validate credentials and measure response latency"
                        >
                          <Zap className={cn("w-3.5 h-3.5 text-brand-orange", isTesting && "animate-spin")} />
                          <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                        </Button>

                        {/* Individual Provider Toggle Switch */}
                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-sm border border-border/60">
                          <label 
                            htmlFor={`provider-toggle-${p.id}`}
                            className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none"
                          >
                            {isEnabled ? 'ON' : 'OFF'}
                          </label>
                          <Switch
                            id={`provider-toggle-${p.id}`}
                            checked={isEnabled}
                            onCheckedChange={(checked) => setProviderEnabled(p.id, checked)}
                            aria-label={`Toggle ${p.name}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Test Connection Real-Time Result Feedback */}
                    {testResult && (
                      <div className={cn(
                        "mt-3 p-2.5 rounded-sm text-xs font-mono flex items-center justify-between border animate-in fade-in duration-200",
                        testResult.success 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      )}>
                        <div className="flex items-center gap-2 truncate">
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 shrink-0 text-destructive" />
                          )}
                          <span className="truncate">{testResult.message}</span>
                        </div>
                        {testResult.latencyMs !== undefined && (
                          <span className="shrink-0 text-[10px] font-bold uppercase bg-background/50 px-2 py-0.5 rounded-xs border border-border/40">
                            Latency: {testResult.latencyMs}ms
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="px-5 pb-5 pt-0 space-y-4">
                    {/* API Key Configuration / Host URL */}
                    {p.id === 'ollama' ? (
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center text-xs">
                        <Input
                          placeholder="http://localhost:11434"
                          value={clientKey}
                          onChange={(e) => setApiKey(p.id, e.target.value)}
                          className="h-8 bg-background/60 border-border/60 text-xs font-mono max-w-sm"
                        />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Local Ollama daemon host URL (proxied via Express).
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-brand-orange" />
                            Client API Key Override (Optional)
                          </Label>
                          {clientKey && (
                            <button
                              type="button"
                              onClick={() => setApiKey(p.id, '')}
                              className="text-[10px] font-mono text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              Clear Key
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder={isServerKeyed ? "Configured on server (Enter key to override)" : `Enter ${p.name} API Key`}
                            value={clientKey}
                            onChange={(e) => setApiKey(p.id, e.target.value)}
                            className="h-8 bg-background/60 border-border/60 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Granular Model Enable / Disable Section */}
                    <div className="pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleExpand(p.id)}
                          className="flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-brand-orange transition-colors cursor-pointer py-1"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-brand-orange" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span className="font-semibold uppercase tracking-wider text-[11px]">
                            Granular Model Controls ({models.length} Models)
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          {isExpanded && models.length > 0 && (
                            <div className="flex items-center gap-2 text-[10px] font-mono">
                              <button
                                type="button"
                                onClick={() => {
                                  models.forEach(m => setModelEnabled(p.id, m.id, true));
                                }}
                                className="text-brand-orange hover:underline cursor-pointer"
                              >
                                Enable All
                              </button>
                              <span className="text-muted-foreground">&bull;</span>
                              <button
                                type="button"
                                onClick={() => {
                                  models.forEach(m => setModelEnabled(p.id, m.id, false));
                                }}
                                className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                              >
                                Disable All
                              </button>
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refreshModels(p.id)}
                            className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                          >
                            <RefreshCw className="w-2.5 h-2.5 mr-1" />
                            Sync Models
                          </Button>
                        </div>
                      </div>

                      {/* Expandable Model List */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                          {models.length === 0 ? (
                            <div className="p-4 text-center rounded-sm bg-muted/20 border border-border/30 text-xs font-mono text-muted-foreground">
                              No models discovered. Click <span className="text-brand-orange">Test Connection</span> or enter an API key to sync models.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {models.map(m => {
                                const modelActive = isModelEnabled(p.id, m.id);
                                return (
                                  <div
                                    key={m.id}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-xs border text-xs font-mono transition-colors",
                                      modelActive 
                                        ? "bg-background/80 border-border/60" 
                                        : "bg-muted/30 border-border/30 opacity-60"
                                    )}
                                  >
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <span className="font-medium text-foreground truncate text-[11px]">
                                        {m.name}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground truncate">
                                        {m.id}
                                      </span>
                                    </div>

                                    <Switch
                                      checked={modelActive}
                                      onCheckedChange={(checked) => setModelEnabled(p.id, m.id, checked)}
                                      size="sm"
                                      aria-label={`Toggle model ${m.name}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TASK MODEL ROUTING TAB */}
        <TabsContent value="tasks" className="space-y-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xs text-foreground">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground font-mono flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-orange" />
                Task-Specific Model Routing & Hyperparameters
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs font-mono">
                Assign specific active providers and enabled models to each reasoning, distillation, and synthesis pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {(Object.keys(TASK_LABELS) as TaskType[]).map((task) => {
                const config = taskConfigs[task];
                if (!config) return null;
                const rawModels = availableModels[config.providerId] || [];
                // Filter only enabled models or show all with badge
                const providerEnabled = Boolean(enabledProviders[config.providerId]);

                return (
                  <div key={task} className="space-y-4 pb-6 border-b border-border/30 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground font-mono">
                          {TASK_LABELS[task]}
                        </h4>
                        {!providerEnabled && (
                          <span className="text-[9px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded-xs uppercase">
                            Provider Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Provider</Label>
                        <Select 
                          value={config.providerId} 
                          onValueChange={(val) => setTaskConfig(task, { ...config, providerId: val, modelId: '' })}
                        >
                          <SelectTrigger className="bg-background border-border/80 text-foreground font-mono text-xs">
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground font-mono text-xs">
                            {providers.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="flex items-center gap-2">
                                  <span>{p.name}</span>
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.2 rounded-xs uppercase",
                                    enabledProviders[p.id] ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-muted"
                                  )}>
                                    {enabledProviders[p.id] ? 'Active' : 'Disabled'}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Model</Label>
                        <Select 
                          value={config.modelId} 
                          onValueChange={(val) => setTaskConfig(task, { ...config, modelId: val })}
                        >
                          <SelectTrigger className="bg-background border-border/80 text-foreground font-mono text-xs">
                            <SelectValue placeholder="Select Model" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground font-mono text-xs">
                            {rawModels.length > 0 ? (
                              rawModels.map(m => {
                                const modelActive = isModelEnabled(config.providerId, m.id);
                                return (
                                  <SelectItem key={m.id} value={m.id}>
                                    <span className="flex items-center gap-2">
                                      <span>{m.name}</span>
                                      {!modelActive && (
                                        <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.2 rounded-xs">
                                          (Disabled in Provider)
                                        </span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="none" disabled>No models loaded</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Temperature</Label>
                          <span className="text-xs font-mono font-bold text-brand-orange">{config.parameters.temperature}</span>
                        </div>
                        <Slider 
                          value={[config.parameters.temperature]} 
                          min={0} 
                          max={1} 
                          step={0.1}
                          onValueChange={(vals) => {
                            const val = Array.isArray(vals) ? vals[0] : vals;
                            setTaskConfig(task, { 
                              ...config, 
                              parameters: { ...config.parameters, temperature: val } 
                            });
                          }}
                          className="[&_[role=slider]]:bg-brand-orange [&_[role=slider]]:border-brand-orange"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Max Tokens</Label>
                        <Input 
                          type="number" 
                          value={config.parameters.maxTokens}
                          onChange={(e) => setTaskConfig(task, { 
                            ...config, 
                            parameters: { ...config.parameters, maxTokens: parseInt(e.target.value) || 0 } 
                          })}
                          className="h-8 bg-background border-border/80 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
