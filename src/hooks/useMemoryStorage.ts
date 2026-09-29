import { useState, useEffect, useCallback } from 'react';
import { useGraph } from '@/src/contexts/GraphContext';
import { MemoryNode, MemorySource } from '@/src/types/graph';
import { db } from '@/src/lib/db';
import { 
  ExternalMemoryConfig, 
  DEFAULT_MEMORY_CONFIG, 
  testExternalMemoryConnection,
  pushMemoriesToExternal,
  pullMemoriesFromExternal,
  ConnectionTestResult,
  SyncResult
} from '@/src/lib/memory/external_service';
import { 
  formatMemoriesAsMarkdown, 
  formatMemoriesAsPlainText, 
  formatMemoriesAsJson, 
  formatMemoriesAsJsonl,
  downloadExportZip,
  MemoryExportFormat
} from '@/src/output/zip';

export function useMemoryStorage() {
  const { state, dispatch } = useGraph();
  const memoriesMap = state.memories || {};
  const memoriesList = Object.values(memoriesMap);

  const [config, setConfig] = useState<ExternalMemoryConfig>(DEFAULT_MEMORY_CONFIG);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null);

  // Load config from Dexie settings table on mount
  useEffect(() => {
    let mounted = true;
    async function loadConfig() {
      try {
        const stored = await db.settings.get('memory_external_config');
        if (stored?.value && mounted) {
          setConfig({ ...DEFAULT_MEMORY_CONFIG, ...stored.value });
        }
      } catch (e) {
        console.warn('Failed to load memory settings from Dexie:', e);
      } finally {
        if (mounted) setIsConfigLoaded(true);
      }
    }
    loadConfig();
    return () => { mounted = false; };
  }, []);

  // Update and persist config
  const updateConfig = useCallback(async (newConfig: Partial<ExternalMemoryConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      db.settings.put({
        key: 'memory_external_config',
        value: updated,
        updatedAt: Date.now()
      }).catch(err => console.error('Failed to save memory config to Dexie:', err));
      return updated;
    });
  }, []);

  // Add Memory
  const addMemory = useCallback(async (params: {
    content: string;
    title?: string;
    source?: MemorySource | string;
    tags?: string[];
    metadata?: Record<string, any>;
  }) => {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newMemory: MemoryNode = {
      id,
      content: params.content,
      title: params.title || undefined,
      source: params.source || (config.storageMode === 'external' ? 'hindsight' : 'user'),
      tags: params.tags || [],
      timestamp: Date.now(),
      metadata: params.metadata || {}
    };

    dispatch({ type: 'ADD_MEMORIES', payload: [newMemory] });

    // If auto-sync or external mode is active, push to remote
    if (config.enabled && (config.autoSyncOnAdd || config.storageMode === 'hybrid' || config.storageMode === 'external')) {
      pushMemoriesToExternal([newMemory], config).then(res => {
        setSyncStatus(res);
      }).catch(err => {
        console.warn('Auto-sync memory failed:', err);
      });
    }

    return newMemory;
  }, [config, dispatch]);

  // Update Memory
  const updateMemory = useCallback(async (memory: MemoryNode) => {
    dispatch({ type: 'UPDATE_MEMORY', payload: memory });
  }, [dispatch]);

  // Delete Memory
  const deleteMemory = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_MEMORY', payload: id });
  }, [dispatch]);

  // Clear Memories
  const clearAllMemories = useCallback(async () => {
    dispatch({ type: 'CLEAR_MEMORIES' });
  }, [dispatch]);

  // Test external connection
  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testExternalMemoryConnection(config);
      setTestResult(res);
      return res;
    } finally {
      setIsTesting(false);
    }
  }, [config]);

  // Sync to external
  const syncToExternal = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await pushMemoriesToExternal(memoriesList, config);
      setSyncStatus(res);
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [config, memoriesList]);

  // Pull from external
  const syncFromExternal = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await pullMemoriesFromExternal(config);
      if (res.success && res.memories.length > 0) {
        dispatch({ type: 'ADD_MEMORIES', payload: res.memories });
        setSyncStatus({
          success: true,
          syncedCount: res.memories.length,
          message: res.message
        });
      } else {
        setSyncStatus({
          success: res.success,
          syncedCount: 0,
          message: res.message
        });
      }
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [config, dispatch]);

  // Export helper
  const exportMemories = useCallback((format: MemoryExportFormat) => {
    if (format === 'all') {
      downloadExportZip(state, {
        memoryOptions: { format: 'all', organization: 'both' }
      }, `memories_bundle_${Date.now()}.zip`);
      return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let filename = `memories_${Date.now()}`;

    if (format === 'markdown') {
      content = formatMemoriesAsMarkdown(memoriesList, {
        customTemplate: config.customTemplate
      });
      mimeType = 'text/markdown';
      filename += '.md';
    } else if (format === 'text') {
      content = formatMemoriesAsPlainText(memoriesList);
      mimeType = 'text/plain';
      filename += '.txt';
    } else if (format === 'json') {
      content = formatMemoriesAsJson(memoriesList);
      mimeType = 'application/json';
      filename += '.json';
    } else if (format === 'jsonl') {
      content = formatMemoriesAsJsonl(memoriesList);
      mimeType = 'application/x-ndjson';
      filename += '.jsonl';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [memoriesList, config.customTemplate, state]);

  return {
    memories: memoriesList,
    memoriesMap,
    memoryCount: memoriesList.length,
    config,
    updateConfig,
    isConfigLoaded,
    addMemory,
    updateMemory,
    deleteMemory,
    clearAllMemories,
    testConnection,
    isTesting,
    testResult,
    syncToExternal,
    syncFromExternal,
    isSyncing,
    syncStatus,
    exportMemories
  };
}
