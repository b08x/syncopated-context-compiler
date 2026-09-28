import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { ModelProvider, TaskType, TaskModelConfig, ModelInfo } from '../types/provider';
import { ProxyAdapter } from '../lib/providers/proxy';
import { OllamaAdapter } from '../lib/providers/ollama';

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  modelsCount?: number;
  timestamp: number;
}

interface ProviderState {
  enabledProviders: Record<string, boolean>;
  disabledModels: Record<string, boolean>; // `${providerId}:${modelId}` -> boolean (true = disabled)
  apiKeys: Record<string, string>;
  taskConfigs: Record<TaskType, TaskModelConfig>;
  availableModels: Record<string, ModelInfo[]>;
  serverKeyStatus: Record<string, boolean>;
  connectionStatus: Record<string, 'connected' | 'checking' | 'error' | 'disabled'>;
  testResults: Record<string, TestConnectionResult>;
}

const DEFAULT_CONFIGS: Record<TaskType, TaskModelConfig> = {
  import: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.1, maxTokens: 1000 } },
  review: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.1, maxTokens: 1000 } },
  trajectory: { providerId: 'google', modelId: 'gemini-3.1-pro-preview', parameters: { temperature: 0.3, maxTokens: 2000 } },
  distillation_weak: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.5, maxTokens: 4000 } },
  distillation_strong: { providerId: 'google', modelId: 'gemini-3.1-pro-preview', parameters: { temperature: 0.5, maxTokens: 4000 } },
  retrieval: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0, maxTokens: 500 } },
  insights: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.7, maxTokens: 2000 } },
  summary: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.5, maxTokens: 1000 } },
  refactor: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.1, maxTokens: 1000 } },
  search: { providerId: 'google', modelId: 'gemini-flash-latest', parameters: { temperature: 0.3, maxTokens: 500 } },
};

const ProviderContext = createContext<{
  providers: ModelProvider[];
  enabledProviders: Record<string, boolean>;
  disabledModels: Record<string, boolean>;
  apiKeys: Record<string, string>;
  taskConfigs: Record<TaskType, TaskModelConfig>;
  availableModels: Record<string, ModelInfo[]>;
  serverKeyStatus: Record<string, boolean>;
  connectionStatus: Record<string, 'connected' | 'checking' | 'error' | 'disabled'>;
  testResults: Record<string, TestConnectionResult>;
  activeProviderId: string;
  hasActiveApiKey: boolean;
  isActiveProviderEnabled: boolean;
  setProviderEnabled: (providerId: string, enabled: boolean) => void;
  isProviderEnabled: (providerId: string) => boolean;
  setModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void;
  isModelEnabled: (providerId: string, modelId: string) => boolean;
  setApiKey: (providerId: string, key: string) => void;
  setTaskConfig: (task: TaskType, config: TaskModelConfig) => void;
  refreshModels: (providerId: string) => Promise<void>;
  testConnection: (providerId: string, customKey?: string) => Promise<TestConnectionResult>;
  checkServerStatus: () => Promise<void>;
  getProvider: (id: string) => ModelProvider | undefined;
} | undefined>(undefined);

export function ProviderProvider({ children }: { children: ReactNode }) {
  const providers = useMemo(() => [
    new ProxyAdapter('google', 'Google Gemini'),
    new ProxyAdapter('openrouter', 'OpenRouter'),
    new ProxyAdapter('mistral', 'Mistral'),
    new ProxyAdapter('groq', 'Groq'),
    new OllamaAdapter(),
  ], []);

  const [state, setState] = useState<ProviderState>(() => {
    const savedEnabled = sessionStorage.getItem('convo_workbench_enabled_providers');
    const savedDisabledModels = sessionStorage.getItem('convo_workbench_disabled_models');
    const savedKeys = sessionStorage.getItem('convo_workbench_api_keys');
    const savedConfigs = sessionStorage.getItem('convo_workbench_task_configs');

    let parsedConfigs: Record<TaskType, TaskModelConfig> = { ...DEFAULT_CONFIGS };
    if (savedConfigs) {
      try {
        const loaded = JSON.parse(savedConfigs);
        // Migrate any deprecated or overloaded model IDs
        Object.keys(loaded).forEach(taskKey => {
          if (loaded[taskKey]?.modelId === 'gemini-3-flash-preview') {
            loaded[taskKey].modelId = 'gemini-flash-latest';
          }
        });
        parsedConfigs = { ...DEFAULT_CONFIGS, ...loaded };
      } catch {
        parsedConfigs = DEFAULT_CONFIGS;
      }
    }

    return {
      enabledProviders: savedEnabled ? JSON.parse(savedEnabled) : { google: true },
      disabledModels: savedDisabledModels ? JSON.parse(savedDisabledModels) : {},
      apiKeys: savedKeys ? JSON.parse(savedKeys) : {},
      taskConfigs: parsedConfigs,
      availableModels: {},
      serverKeyStatus: {},
      connectionStatus: {},
      testResults: {},
    };
  });

  useEffect(() => {
    sessionStorage.setItem('convo_workbench_enabled_providers', JSON.stringify(state.enabledProviders));
  }, [state.enabledProviders]);

  useEffect(() => {
    sessionStorage.setItem('convo_workbench_disabled_models', JSON.stringify(state.disabledModels));
  }, [state.disabledModels]);

  useEffect(() => {
    sessionStorage.setItem('convo_workbench_api_keys', JSON.stringify(state.apiKeys));
  }, [state.apiKeys]);

  useEffect(() => {
    sessionStorage.setItem('convo_workbench_task_configs', JSON.stringify(state.taskConfigs));
  }, [state.taskConfigs]);

  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/llm/status');
      if (res.ok) {
        const data = await res.json();
        setState(prev => {
          const newStatus: Record<string, 'connected' | 'checking' | 'error' | 'disabled'> = {};
          providers.forEach(p => {
            const isEnabled = Boolean(prev.enabledProviders[p.id]);
            newStatus[p.id] = isEnabled ? 'connected' : 'disabled';
          });
          return {
            ...prev,
            serverKeyStatus: data.providers || {},
            connectionStatus: newStatus
          };
        });
      }
    } catch {
      setState(prev => {
        const newStatus: Record<string, 'connected' | 'checking' | 'error' | 'disabled'> = {};
        providers.forEach(p => {
          const isEnabled = Boolean(prev.enabledProviders[p.id]);
          newStatus[p.id] = isEnabled ? 'error' : 'disabled';
        });
        return {
          ...prev,
          connectionStatus: newStatus
        };
      });
    }
  };

  useEffect(() => {
    checkServerStatus();
  }, [state.enabledProviders]);

  const setProviderEnabled = (providerId: string, enabled: boolean) => {
    setState(prev => ({
      ...prev,
      enabledProviders: {
        ...prev.enabledProviders,
        [providerId]: enabled,
      },
      connectionStatus: {
        ...prev.connectionStatus,
        [providerId]: enabled ? 'connected' : 'disabled'
      }
    }));
  };

  const isProviderEnabled = (providerId: string) => Boolean(state.enabledProviders[providerId]);

  const setModelEnabled = (providerId: string, modelId: string, enabled: boolean) => {
    const key = `${providerId}:${modelId}`;
    setState(prev => ({
      ...prev,
      disabledModels: {
        ...prev.disabledModels,
        [key]: !enabled, // if enabled is true, disabled is false
      }
    }));
  };

  const isModelEnabled = (providerId: string, modelId: string) => {
    const key = `${providerId}:${modelId}`;
    return !state.disabledModels[key]; // enabled by default if provider is enabled
  };

  const setApiKey = (providerId: string, key: string) => {
    setState(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [providerId]: key }
    }));
  };

  const setTaskConfig = (task: TaskType, config: TaskModelConfig) => {
    setState(prev => ({
      ...prev,
      taskConfigs: { ...prev.taskConfigs, [task]: config }
    }));
  };

  const refreshModels = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    try {
      const key = state.apiKeys[providerId];
      const models = await provider.fetchModels(key);
      const uniqueModels = Array.from(new Map(models.map(m => [m.id, m])).values());
      
      setState(prev => ({
        ...prev,
        availableModels: { ...prev.availableModels, [providerId]: uniqueModels }
      }));
    } catch (err) {
      console.error(`Failed to fetch models for ${providerId}:`, err);
    }
  };

  const testConnection = async (providerId: string, customKey?: string): Promise<TestConnectionResult> => {
    setState(prev => ({
      ...prev,
      connectionStatus: { ...prev.connectionStatus, [providerId]: 'checking' }
    }));

    try {
      const key = customKey !== undefined ? customKey : state.apiKeys[providerId];
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: key })
      });
      const data = await res.json();

      const result: TestConnectionResult = {
        success: Boolean(data.success),
        message: data.message || data.error || 'Connection failed',
        latencyMs: data.latencyMs,
        modelsCount: data.modelsCount,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          [providerId]: result.success ? (prev.enabledProviders[providerId] ? 'connected' : 'disabled') : 'error'
        },
        testResults: {
          ...prev.testResults,
          [providerId]: result
        }
      }));

      if (result.success) {
        refreshModels(providerId);
      }

      return result;
    } catch (err: any) {
      const result: TestConnectionResult = {
        success: false,
        message: err.message || 'Network error while testing connection',
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        connectionStatus: { ...prev.connectionStatus, [providerId]: 'error' },
        testResults: { ...prev.testResults, [providerId]: result }
      }));

      return result;
    }
  };

  const activeProviderId = state.taskConfigs.review?.providerId || 'google';
  const isActiveProviderEnabled = Boolean(state.enabledProviders[activeProviderId]);
  const hasActiveApiKey = Boolean(
    state.serverKeyStatus[activeProviderId] ||
    state.apiKeys[activeProviderId] ||
    activeProviderId === 'ollama'
  );

  const getProvider = (id: string) => providers.find(p => p.id === id);

  return (
    <ProviderContext.Provider value={{ 
      providers, 
      enabledProviders: state.enabledProviders,
      disabledModels: state.disabledModels,
      apiKeys: state.apiKeys,
      taskConfigs: state.taskConfigs, 
      availableModels: state.availableModels,
      serverKeyStatus: state.serverKeyStatus,
      connectionStatus: state.connectionStatus,
      testResults: state.testResults,
      activeProviderId,
      hasActiveApiKey,
      isActiveProviderEnabled,
      setProviderEnabled,
      isProviderEnabled,
      setModelEnabled,
      isModelEnabled,
      setApiKey,
      setTaskConfig,
      refreshModels,
      testConnection,
      checkServerStatus,
      getProvider
    }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(ProviderContext);
  if (!context) throw new Error('useProvider must be used within a ProviderProvider');
  return context;
}
