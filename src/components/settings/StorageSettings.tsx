import React, { useState, useEffect } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { db, getStorageStats, StorageStats } from '@/src/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { 
  Database, 
  HardDrive, 
  Trash2, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  MessageSquare, 
  FileText, 
  Zap, 
  Tag, 
  FileCode,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function StorageSettings() {
  const { 
    state, 
    isHydrated, 
    isPersisting, 
    lastSavedAt, 
    storageStats, 
    refreshStorageStats, 
    clearGraph, 
    saveCurrentGraph 
  } = useGraph();

  const [confirmClear, setConfirmClear] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    refreshStorageStats();
  }, [refreshStorageStats]);

  const handleManualSync = async () => {
    setSyncStatus('Syncing to Dexie IndexedDB...');
    await saveCurrentGraph();
    setSyncStatus('Successfully synchronized with IndexedDB');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleExportBackup = () => {
    try {
      setIsExporting(true);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `syncopated-graph-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearGraph();
    setConfirmClear(false);
    setSyncStatus('Dexie IndexedDB database cleared');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tableStats = [
    { name: 'Conversations', count: storageStats?.conversations ?? 0, icon: MessageSquare, color: 'text-brand-orange' },
    { name: 'Messages', count: storageStats?.messages ?? 0, icon: Layers, color: 'text-brand-blue' },
    { name: 'Topics', count: storageStats?.topics ?? 0, icon: Tag, color: 'text-purple-400' },
    { name: 'Trajectories', count: storageStats?.trajectories ?? 0, icon: FileText, color: 'text-emerald-400' },
    { name: 'Distilled Skills', count: storageStats?.skills ?? 0, icon: Zap, color: 'text-amber-400' },
    { name: 'Artifacts', count: storageStats?.artifacts ?? 0, icon: FileCode, color: 'text-indigo-400' },
    { name: 'Project Docs', count: storageStats?.projectDocs ?? 0, icon: FileText, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center text-brand-orange">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  Dexie.js IndexedDB Engine
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    Active & Persistent
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Native browser-level storage engine powered by Dexie.js for instant offline access and multi-session persistence.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isPersisting}
                className="gap-1.5 font-mono text-xs border-border/60"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isPersisting && "animate-spin text-brand-orange")} />
                Force Sync
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="gap-1.5 font-mono text-xs border-border/60"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {syncStatus && (
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {syncStatus}
            </div>
          )}

          {/* Engine Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-md bg-muted/30 border border-border/40 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Hydration</span>
              <div className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <span className={cn("w-2 h-2 rounded-full", isHydrated ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                {isHydrated ? 'Hydrated' : 'Loading...'}
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 border border-border/40 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Sync Status</span>
              <div className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                {isPersisting ? (
                  <span className="text-brand-orange flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Up to Date
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 border border-border/40 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Storage Usage</span>
              <div className="text-sm font-semibold text-foreground font-mono">
                {formatBytes(storageStats?.storageEstimateBytes)}
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 border border-border/40 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Last Sync</span>
              <div className="text-xs font-semibold text-muted-foreground font-mono truncate">
                {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Tables & Record Counts */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-orange" />
            IndexedDB Tables & Records
          </CardTitle>
          <CardDescription className="text-xs">
            Individual tables managed in <code className="font-mono text-brand-orange">SyncopatedContextCompilerDB</code>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tableStats.map((item) => (
              <div key={item.name} className="p-3 rounded-md bg-muted/20 border border-border/40 flex items-center gap-3">
                <div className={cn("p-2 rounded bg-muted/50", item.color)}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-foreground leading-tight">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone / Reset Database */}
      <Card className="border-destructive/30 bg-destructive/5 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Purge Local IndexedDB Database
          </CardTitle>
          <CardDescription className="text-xs">
            Clears all conversations, messages, trajectories, and distilled skills from this browser. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {confirmClear ? (
              <span className="text-destructive font-semibold">Are you sure? Click again to permanently erase all IndexedDB tables.</span>
            ) : (
              <span>Permanently remove all cached items from Dexie.js.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {confirmClear && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearDatabase}
              className="gap-1.5 text-xs font-mono"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmClear ? 'Confirm Purge' : 'Clear Database'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
