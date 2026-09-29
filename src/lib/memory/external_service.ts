import { MemoryNode } from '@/src/types/graph';

export type MemoryStorageMode = 'dexie' | 'external' | 'hybrid';
export type MemoryExportFormat = 'markdown' | 'text' | 'json' | 'jsonl' | 'all';
export type ExternalServiceType = 'hindsight' | 'generic_rest';

export interface ExternalMemoryConfig {
  enabled: boolean;
  storageMode: MemoryStorageMode;
  serviceType: ExternalServiceType;
  endpointUrl: string;
  apiKey?: string;
  bankId?: string; // Hindsight bank_id or namespace
  autoSyncOnAdd?: boolean;
  exportFormat?: MemoryExportFormat;
  customTemplate?: string;
}

export const DEFAULT_MEMORY_CONFIG: ExternalMemoryConfig = {
  enabled: false,
  storageMode: 'dexie',
  serviceType: 'hindsight',
  endpointUrl: 'http://localhost:8080/v1/memory',
  apiKey: '',
  bankId: 'agent-workspace',
  autoSyncOnAdd: false,
  exportFormat: 'markdown',
  customTemplate: `# {{title}}
- **Source:** {{source}}
- **Date:** {{date}}
{{tags_section}}

{{content}}`
};

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  statusCode?: number;
  details?: any;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  message: string;
  details?: any;
}

/**
 * Tests connection to external memory service (e.g., Vectorize Hindsight or REST endpoint)
 */
export async function testExternalMemoryConnection(config: ExternalMemoryConfig): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const endpoint = config.endpointUrl?.trim();
  
  if (!endpoint) {
    return {
      success: false,
      message: 'External memory endpoint URL is required.'
    };
  }

  // Attempt server proxy first (avoids browser CORS issues)
  try {
    const res = await fetch('/api/memory/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointUrl: endpoint,
        apiKey: config.apiKey,
        bankId: config.bankId,
        serviceType: config.serviceType
      })
    });

    const data = await res.json();
    const latencyMs = Date.now() - startTime;

    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || `Connected successfully to ${config.serviceType === 'hindsight' ? 'Vectorize Hindsight' : 'Memory API'}!`,
        latencyMs,
        statusCode: data.statusCode || res.status,
        details: data.details
      };
    } else {
      // If proxy returned a handled error
      return {
        success: false,
        message: data.error || data.message || `Endpoint returned status ${res.status}`,
        latencyMs,
        statusCode: res.status
      };
    }
  } catch (proxyErr: any) {
    // If server proxy fails or network error, attempt direct client fetch
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        headers['x-api-key'] = config.apiKey;
      }
      if (config.bankId) {
        headers['x-bank-id'] = config.bankId;
      }

      // Try GET ping / health
      const directRes = await fetch(endpoint, {
        method: 'GET',
        headers
      });

      const latencyMs = Date.now() - startTime;
      if (directRes.ok || directRes.status === 404 || directRes.status === 405) {
        return {
          success: true,
          message: `Endpoint reachable (HTTP ${directRes.status})`,
          latencyMs,
          statusCode: directRes.status
        };
      }

      return {
        success: false,
        message: `HTTP error ${directRes.status} from ${endpoint}`,
        latencyMs,
        statusCode: directRes.status
      };
    } catch (directErr: any) {
      return {
        success: false,
        message: directErr.message || 'Could not reach endpoint. Check URL or verify service is running.',
        latencyMs: Date.now() - startTime
      };
    }
  }
}

/**
 * Push memories to external service
 */
export async function pushMemoriesToExternal(
  memories: MemoryNode[],
  config: ExternalMemoryConfig
): Promise<SyncResult> {
  const endpoint = config.endpointUrl?.trim();
  if (!endpoint) {
    return { success: false, syncedCount: 0, message: 'Missing endpoint URL' };
  }

  const payload = {
    bankId: config.bankId || 'agent-workspace',
    serviceType: config.serviceType,
    endpointUrl: endpoint,
    apiKey: config.apiKey,
    memories: memories.map(m => ({
      id: m.id,
      content: m.content,
      source: m.source,
      timestamp: m.timestamp,
      title: m.title || `Memory ${m.id.slice(0, 8)}`,
      tags: m.tags || [],
      metadata: {
        ...(m.metadata || {}),
        exportedFrom: 'ConvoWorkbench',
        exportedAt: Date.now()
      }
    }))
  };

  try {
    const res = await fetch('/api/memory/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        syncedCount: data.syncedCount ?? memories.length,
        message: data.message || `Successfully synced ${memories.length} memories to ${config.serviceType === 'hindsight' ? 'Hindsight' : 'external service'}.`
      };
    } else {
      throw new Error(data.error || data.message || `Failed with status ${res.status}`);
    }
  } catch (err: any) {
    return {
      success: false,
      syncedCount: 0,
      message: err.message || 'Failed to sync memories to external service.'
    };
  }
}

/**
 * Pull memories from external service into ConvoWorkbench
 */
export async function pullMemoriesFromExternal(
  config: ExternalMemoryConfig
): Promise<{ success: boolean; memories: MemoryNode[]; message: string }> {
  const endpoint = config.endpointUrl?.trim();
  if (!endpoint) {
    return { success: false, memories: [], message: 'Missing endpoint URL' };
  }

  try {
    const res = await fetch('/api/memory/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointUrl: endpoint,
        apiKey: config.apiKey,
        bankId: config.bankId || 'agent-workspace',
        serviceType: config.serviceType
      })
    });

    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.memories)) {
      const parsedMemories: MemoryNode[] = data.memories.map((raw: any, idx: number) => {
        const id = raw.id || raw.uuid || `ext-mem-${Date.now()}-${idx}`;
        const source = raw.source || (config.serviceType === 'hindsight' ? 'hindsight' : 'external');
        return {
          id,
          source,
          content: raw.content || raw.text || raw.memory || JSON.stringify(raw),
          timestamp: raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now(),
          title: raw.title || raw.metadata?.title,
          tags: raw.tags || raw.metadata?.tags || [],
          metadata: raw.metadata || {},
          external_id: raw.id || raw.external_id
        };
      });

      return {
        success: true,
        memories: parsedMemories,
        message: `Successfully pulled ${parsedMemories.length} memories from external service.`
      };
    } else {
      throw new Error(data.error || data.message || 'Invalid response from external memory service');
    }
  } catch (err: any) {
    return {
      success: false,
      memories: [],
      message: err.message || 'Failed to pull memories from external service.'
    };
  }
}
