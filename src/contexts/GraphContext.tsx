import React, { createContext, useContext, useReducer, ReactNode, useEffect, useState, useCallback } from 'react';
import { ConvoGraph, ConversationRating, ProjectDocNode, MemoryNode } from '../types/graph';
import { createEmptyGraph } from '../lib/graph/builder';
import { 
  loadFullGraph, 
  saveFullGraph, 
  updateConversationRatingInDb, 
  addTrajectoriesToDb, 
  addSkillsToDb, 
  addProjectDocsToDb, 
  addMemoriesToDb,
  updateMemoryInDb,
  deleteMemoryFromDb,
  clearMemoriesInDb,
  clearAllDatabase,
  getStorageStats,
  StorageStats
} from '../lib/db';

type Action =
  | { type: 'SET_GRAPH'; payload: ConvoGraph; skipPersist?: boolean }
  | { type: 'UPDATE_CONVERSATION_RATING'; payload: { id: string; rating: ConversationRating | null; notes: string } }
  | { type: 'ADD_TRAJECTORIES'; payload: any[] }
  | { type: 'ADD_SKILLS'; payload: any[] }
  | { type: 'ADD_PROJECT_DOCS'; payload: ProjectDocNode[] }
  | { type: 'ADD_MEMORIES'; payload: MemoryNode[] }
  | { type: 'UPDATE_MEMORY'; payload: MemoryNode }
  | { type: 'DELETE_MEMORY'; payload: string }
  | { type: 'CLEAR_MEMORIES' }
  | { type: 'RESET_GRAPH' };

interface GraphContextValue {
  state: ConvoGraph;
  dispatch: React.Dispatch<Action>;
  isHydrated: boolean;
  isPersisting: boolean;
  lastSavedAt: number | null;
  storageStats: StorageStats | null;
  refreshStorageStats: () => Promise<void>;
  clearGraph: () => Promise<void>;
  saveCurrentGraph: () => Promise<void>;
}

const GraphContext = createContext<GraphContextValue | undefined>(undefined);

function graphReducer(state: ConvoGraph, action: Action): ConvoGraph {
  switch (action.type) {
    case 'SET_GRAPH':
      return action.payload;
    case 'UPDATE_CONVERSATION_RATING':
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.payload.id]: {
            ...state.conversations[action.payload.id],
            rating: action.payload.rating,
            notes: action.payload.notes,
          },
        },
        meta: {
          ...state.meta,
          stats: {
            ...state.meta.stats,
            rated_count: Object.values({
              ...state.conversations,
              [action.payload.id]: {
                ...state.conversations[action.payload.id],
                rating: action.payload.rating,
              }
            }).filter(c => c.rating !== null).length
          }
        }
      };
    case 'ADD_TRAJECTORIES':
      const newTrajs = { ...state.trajectories };
      action.payload.forEach(t => newTrajs[t.id] = t);
      return { ...state, trajectories: newTrajs };
    case 'ADD_SKILLS':
      const newSkills = { ...state.skills };
      action.payload.forEach(s => newSkills[s.id] = s);
      return { ...state, skills: newSkills };
    case 'ADD_PROJECT_DOCS':
      const newDocs = { ...state.project_docs };
      action.payload.forEach(d => newDocs[d.id] = d);
      return { ...state, project_docs: newDocs };
    case 'ADD_MEMORIES':
      const newMemories = { ...state.memories };
      action.payload.forEach(m => newMemories[m.id] = m);
      return { 
        ...state, 
        memories: newMemories,
        meta: {
          ...state.meta,
          stats: {
            ...state.meta.stats,
            memory_count: Object.keys(newMemories).length
          }
        }
      };
    case 'UPDATE_MEMORY':
      return {
        ...state,
        memories: {
          ...state.memories,
          [action.payload.id]: action.payload
        }
      };
    case 'DELETE_MEMORY':
      const remainingMemories = { ...state.memories };
      delete remainingMemories[action.payload];
      return {
        ...state,
        memories: remainingMemories,
        meta: {
          ...state.meta,
          stats: {
            ...state.meta.stats,
            memory_count: Object.keys(remainingMemories).length
          }
        }
      };
    case 'CLEAR_MEMORIES':
      return {
        ...state,
        memories: {},
        meta: {
          ...state.meta,
          stats: {
            ...state.meta.stats,
            memory_count: 0
          }
        }
      };
    case 'RESET_GRAPH':
      return createEmptyGraph();
    default:
      return state;
  }
}

export function GraphProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(graphReducer, createEmptyGraph());
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
      if (stats.lastSavedAt) {
        setLastSavedAt(stats.lastSavedAt);
      }
    } catch (e) {
      console.error('Failed to get Dexie storage stats:', e);
    }
  }, []);

  // Hydrate initial state from Dexie IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function hydrate() {
      try {
        const persistedGraph = await loadFullGraph();
        if (persistedGraph && isMounted) {
          baseDispatch({ type: 'SET_GRAPH', payload: persistedGraph, skipPersist: true });
        }
      } catch (err) {
        console.error('Dexie hydration error:', err);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
          refreshStorageStats();
        }
      }
    }
    hydrate();
    return () => { isMounted = false; };
  }, [refreshStorageStats]);

  // Wrapped dispatch that automatically synchronizes state changes to Dexie
  const dispatch = useCallback((action: Action) => {
    baseDispatch(action);

    // Asynchronous background persistence to Dexie IndexedDB
    (async () => {
      try {
        setIsPersisting(true);
        if (action.type === 'SET_GRAPH') {
          if (!action.skipPersist) {
            await saveFullGraph(action.payload);
            setLastSavedAt(Date.now());
          }
        } else if (action.type === 'UPDATE_CONVERSATION_RATING') {
          await updateConversationRatingInDb(
            action.payload.id,
            action.payload.rating,
            action.payload.notes
          );
          setLastSavedAt(Date.now());
        } else if (action.type === 'ADD_TRAJECTORIES') {
          await addTrajectoriesToDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'ADD_SKILLS') {
          await addSkillsToDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'ADD_PROJECT_DOCS') {
          await addProjectDocsToDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'ADD_MEMORIES') {
          await addMemoriesToDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'UPDATE_MEMORY') {
          await updateMemoryInDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'DELETE_MEMORY') {
          await deleteMemoryFromDb(action.payload);
          setLastSavedAt(Date.now());
        } else if (action.type === 'CLEAR_MEMORIES') {
          await clearMemoriesInDb();
          setLastSavedAt(Date.now());
        } else if (action.type === 'RESET_GRAPH') {
          await clearAllDatabase();
          setLastSavedAt(null);
        }
      } catch (err) {
        console.error('Failed to persist action to Dexie:', action.type, err);
      } finally {
        setIsPersisting(false);
        refreshStorageStats();
      }
    })();
  }, [refreshStorageStats]);

  const clearGraph = useCallback(async () => {
    setIsPersisting(true);
    try {
      await clearAllDatabase();
      baseDispatch({ type: 'RESET_GRAPH' });
      setLastSavedAt(null);
      await refreshStorageStats();
    } catch (e) {
      console.error('Failed to clear Dexie database:', e);
    } finally {
      setIsPersisting(false);
    }
  }, [refreshStorageStats]);

  const saveCurrentGraph = useCallback(async () => {
    setIsPersisting(true);
    try {
      await saveFullGraph(state);
      setLastSavedAt(Date.now());
      await refreshStorageStats();
    } catch (e) {
      console.error('Failed to manually save graph to Dexie:', e);
    } finally {
      setIsPersisting(false);
    }
  }, [state, refreshStorageStats]);

  return (
    <GraphContext.Provider 
      value={{ 
        state, 
        dispatch, 
        isHydrated, 
        isPersisting, 
        lastSavedAt, 
        storageStats, 
        refreshStorageStats, 
        clearGraph, 
        saveCurrentGraph 
      }}
    >
      {children}
    </GraphContext.Provider>
  );
}

export function useGraph() {
  const context = useContext(GraphContext);
  if (!context) throw new Error('useGraph must be used within a GraphProvider');
  return context;
}
