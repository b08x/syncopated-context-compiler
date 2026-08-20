import React, { useState } from 'react';
import { useProvider } from '@/src/contexts/ProviderContext';
import { Switch } from '@/src/components/ui/switch';
import { Button } from '@/src/components/ui/button';
import { 
  Sparkles, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  ChevronDown,
  ExternalLink,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

export function AIStatusIndicator() {
  const { 
    enabledProviders,
    setProviderEnabled,
    activeProviderId, 
    providers, 
    hasActiveApiKey,
    isActiveProviderEnabled,
    connectionStatus,
    testConnection,
    testResults,
    serverKeyStatus,
    apiKeys
  } = useProvider();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const activeProvider = providers.find(p => p.id === activeProviderId) || providers[0];
  const isOllama = activeProviderId === 'ollama';
  const hasKey = hasActiveApiKey || isOllama;
  const currentConn = connectionStatus[activeProviderId] || (isActiveProviderEnabled ? 'connected' : 'disabled');

  const handleTest = async (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(providerId);
    await testConnection(providerId);
    setTestingId(null);
  };

  return (
    <div className="relative flex items-center gap-2.5">
      {/* Top Right Non-Intrusive Status Indicator Pill */}
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-sm border text-xs font-mono transition-all duration-200 cursor-pointer select-none",
          !isActiveProviderEnabled 
            ? "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/30"
            : currentConn === 'connected' && hasKey
              ? "bg-card border-border hover:border-brand-orange/40 hover:bg-accent/40 text-foreground"
              : currentConn === 'checking'
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : !hasKey
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
        )}
        title="AI Providers Status & Config (Click for details)"
      >
        {/* Status Pulsing Dot */}
        <span className="relative flex h-2 w-2">
          {!isActiveProviderEnabled ? (
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          ) : currentConn === 'connected' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </>
          ) : currentConn === 'checking' ? (
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          )}
        </span>

        {/* Active Provider Name */}
        <span className="text-[11px] font-medium tracking-tight truncate max-w-[100px] sm:max-w-[140px]">
          {activeProvider?.name}
        </span>

        {/* State Badge */}
        <span 
          className={cn(
            "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-xs border uppercase font-bold",
            !isActiveProviderEnabled
              ? "border-border/60 text-muted-foreground bg-muted/40"
              : hasKey
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          {!isActiveProviderEnabled ? (
            'Disabled'
          ) : hasKey ? (
            <>
              <Key className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Active</span>
            </>
          ) : (
            'No Key'
          )}
        </span>

        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform duration-200", popoverOpen && "rotate-180")} />
      </button>

      {/* Popover Menu with Modular Switches & Connection Tester */}
      {popoverOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setPopoverOpen(false)} 
          />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-84 rounded-sm border border-border bg-card p-3.5 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-foreground">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">
                  AI Providers Matrix
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">
                Modular Controls
              </span>
            </div>

            {/* List of Modular Switches for each AI Provider */}
            <div className="space-y-2 py-1 max-h-72 overflow-y-auto">
              {providers.map(p => {
                const isEnabled = Boolean(enabledProviders[p.id]);
                const isCurrent = p.id === activeProviderId;
                const hasProvKey = Boolean(serverKeyStatus[p.id] || apiKeys[p.id] || p.id === 'ollama');
                const lastTest = testResults[p.id];

                return (
                  <div 
                    key={p.id}
                    className={cn(
                      "p-2.5 rounded-sm border transition-all duration-150 space-y-1.5",
                      isEnabled ? "border-brand-orange/30 bg-card/80 shadow-xs" : "border-border/50 bg-background/50 opacity-75 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-foreground">
                          {p.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[8px] font-mono bg-brand-orange/20 text-brand-orange px-1 py-0.2 rounded-xs uppercase font-bold">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={isEnabled}
                          onCheckedChange={(checked) => setProviderEnabled(p.id, checked)}
                          size="sm"
                          aria-label={`Toggle ${p.name}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Key className="w-2.5 h-2.5" />
                        <span>
                          {hasProvKey ? (
                            <span className="text-emerald-500">Key Ready</span>
                          ) : (
                            <span className="text-amber-500">No Key</span>
                          )}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleTest(p.id, e)}
                        disabled={testingId === p.id}
                        className="h-5 px-1.5 text-[9px] uppercase font-bold text-brand-orange hover:bg-brand-orange/10 cursor-pointer"
                      >
                        {testingId === p.id ? (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin mr-1" />
                        ) : (
                          <Zap className="w-2.5 h-2.5 mr-1" />
                        )}
                        Test Connection
                      </Button>
                    </div>

                    {lastTest && (
                      <div className={cn(
                        "text-[9px] font-mono p-1 rounded-xs flex items-center justify-between",
                        lastTest.success ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                      )}>
                        <span className="truncate max-w-[180px]">{lastTest.message}</span>
                        {lastTest.latencyMs && <span>{lastTest.latencyMs}ms</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Keys, models & granular parameters
              </span>
              <Link
                to="/settings"
                onClick={() => setPopoverOpen(false)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-orange hover:underline font-mono"
              >
                Settings <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
