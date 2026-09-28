import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AppDatabase, SessionRecord } from '../lib/db';

export interface UseDatabaseOptions<T> {
  key?: string;
  category?: string;
  initialValue?: T;
  autoLoad?: boolean;
}

export interface UseDatabaseReturn<T> {
  // Direct access to the underlying Dexie instance
  db: AppDatabase;
  
  // State for specific key (if initialized with options.key)
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  updatedAt: number | null;

  // Key-specific convenience methods
  save: (data: T, category?: string) => Promise<void>;
  reload: () => Promise<T | null>;
  remove: () => Promise<void>;

  // Generic CRUD operations for any session item
  getItem: <V = T>(key: string) => Promise<V | null>;
  setItem: <V = T>(key: string, data: V, category?: string) => Promise<void>;
  removeItem: (key: string) => Promise<boolean>;
  hasItem: (key: string) => Promise<boolean>;
  clearCategory: (category: string) => Promise<number>;
  clearAllSessions: () => Promise<void>;
  listKeys: (category?: string) => Promise<string[]>;
  getAllSessions: (category?: string) => Promise<SessionRecord[]>;
}

/**
 * Custom React hook that wraps the Dexie instance, providing simple and robust
 * CRUD methods for storing, querying, and retrieving session data across application components.
 *
 * Can be used in two ways:
 * 1. Key-bound session hook:
 *    const { data, save, remove } = useDatabase<FilterState>({ key: 'review_filters', initialValue: defaultFilters });
 *
 * 2. Unbound CRUD utility hook:
 *    const { getItem, setItem, removeItem, db } = useDatabase();
 */
export function useDatabase<T = any>(options?: UseDatabaseOptions<T>): UseDatabaseReturn<T> {
  const targetKey = options?.key;
  const targetCategory = options?.category;
  const initialValue = options?.initialValue ?? null;
  const autoLoad = options?.autoLoad !== false;

  // Reactive subscription to Dexie's sessions table for the specific key (if provided)
  const liveRecord = useLiveQuery(
    async () => {
      if (!targetKey) return undefined;
      return await db.sessions.get(targetKey);
    },
    [targetKey]
  );

  const [localData, setLocalData] = useState<T | null>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(targetKey && autoLoad));
  const [error, setError] = useState<Error | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // Sync state when liveQuery emits or on mount
  useEffect(() => {
    if (!targetKey) {
      setIsLoading(false);
      return;
    }

    if (liveRecord !== undefined) {
      if (liveRecord) {
        setLocalData(liveRecord.data as T);
        setUpdatedAt(liveRecord.updatedAt);
      } else {
        setLocalData(initialValue);
        setUpdatedAt(null);
      }
      setIsLoading(false);
    }
  }, [liveRecord, targetKey, initialValue]);

  // Generic CRUD: Retrieve an item by key
  const getItem = useCallback(async <V = T>(key: string): Promise<V | null> => {
    try {
      const record = await db.sessions.get(key);
      return record ? (record.data as V) : null;
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Generic CRUD: Store an item by key
  const setItem = useCallback(async <V = T>(key: string, data: V, category?: string): Promise<void> => {
    try {
      setError(null);
      const existing = await db.sessions.get(key);
      const now = Date.now();
      await db.sessions.put({
        key,
        data,
        category: category ?? existing?.category ?? targetCategory,
        updatedAt: now,
        createdAt: existing?.createdAt ?? now,
      });
    } catch (err: any) {
      const formatted = err instanceof Error ? err : new Error(String(err));
      setError(formatted);
      throw formatted;
    }
  }, [targetCategory]);

  // Generic CRUD: Remove an item by key
  const removeItem = useCallback(async (key: string): Promise<boolean> => {
    try {
      setError(null);
      const exists = await db.sessions.get(key);
      if (exists) {
        await db.sessions.delete(key);
        return true;
      }
      return false;
    } catch (err: any) {
      const formatted = err instanceof Error ? err : new Error(String(err));
      setError(formatted);
      throw formatted;
    }
  }, []);

  // Generic CRUD: Check if an item exists
  const hasItem = useCallback(async (key: string): Promise<boolean> => {
    try {
      const count = await db.sessions.where('key').equals(key).count();
      return count > 0;
    } catch {
      return false;
    }
  }, []);

  // Generic CRUD: Clear all items in a category
  const clearCategory = useCallback(async (category: string): Promise<number> => {
    try {
      setError(null);
      return await db.sessions.where('category').equals(category).delete();
    } catch (err: any) {
      const formatted = err instanceof Error ? err : new Error(String(err));
      setError(formatted);
      throw formatted;
    }
  }, []);

  // Generic CRUD: Clear all sessions table items
  const clearAllSessions = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await db.sessions.clear();
      if (targetKey) {
        setLocalData(initialValue);
        setUpdatedAt(null);
      }
    } catch (err: any) {
      const formatted = err instanceof Error ? err : new Error(String(err));
      setError(formatted);
      throw formatted;
    }
  }, [targetKey, initialValue]);

  // Generic Query: List all keys (optionally filtered by category)
  const listKeys = useCallback(async (category?: string): Promise<string[]> => {
    try {
      if (category) {
        const records = await db.sessions.where('category').equals(category).toArray();
        return records.map(r => r.key);
      }
      const records = await db.sessions.toArray();
      return records.map(r => r.key);
    } catch {
      return [];
    }
  }, []);

  // Generic Query: Get all session records
  const getAllSessions = useCallback(async (category?: string): Promise<SessionRecord[]> => {
    try {
      if (category) {
        return await db.sessions.where('category').equals(category).toArray();
      }
      return await db.sessions.toArray();
    } catch {
      return [];
    }
  }, []);

  // Key-specific convenience: Save current key
  const save = useCallback(async (data: T, category?: string): Promise<void> => {
    if (!targetKey) {
      throw new Error('useDatabase.save() requires a "key" parameter provided in hook options');
    }
    await setItem(targetKey, data, category ?? targetCategory);
    setLocalData(data);
    setUpdatedAt(Date.now());
  }, [targetKey, targetCategory, setItem]);

  // Key-specific convenience: Reload current key
  const reload = useCallback(async (): Promise<T | null> => {
    if (!targetKey) return null;
    setIsLoading(true);
    try {
      const val = await getItem<T>(targetKey);
      setLocalData(val ?? initialValue);
      return val ?? initialValue;
    } finally {
      setIsLoading(false);
    }
  }, [targetKey, getItem, initialValue]);

  // Key-specific convenience: Delete current key
  const remove = useCallback(async (): Promise<void> => {
    if (!targetKey) {
      throw new Error('useDatabase.remove() requires a "key" parameter provided in hook options');
    }
    await removeItem(targetKey);
    setLocalData(initialValue);
    setUpdatedAt(null);
  }, [targetKey, removeItem, initialValue]);

  return {
    db,
    data: localData,
    isLoading,
    error,
    updatedAt,
    save,
    reload,
    remove,
    getItem,
    setItem,
    removeItem,
    hasItem,
    clearCategory,
    clearAllSessions,
    listKeys,
    getAllSessions,
  };
}

export default useDatabase;
