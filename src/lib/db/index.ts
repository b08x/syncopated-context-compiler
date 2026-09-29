import Dexie, { Table } from 'dexie';
import { 
  ConvoGraph, 
  ConversationNode, 
  MessageNode, 
  TopicNode, 
  TrajectoryNode, 
  SkillNode, 
  MemoryNode, 
  ArtifactNode, 
  ProjectDocNode, 
  ConversationRating,
  GraphMeta 
} from '../../types/graph';
import { createEmptyGraph } from '../graph/builder';

export interface MetaRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export interface SettingRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export interface SessionRecord<T = any> {
  key: string;
  data: T;
  category?: string;
  updatedAt: number;
  createdAt: number;
}

export interface StorageStats {
  conversations: number;
  messages: number;
  topics: number;
  trajectories: number;
  skills: number;
  artifacts: number;
  projectDocs: number;
  memories: number;
  sessions: number;
  storageEstimateBytes?: number;
  quotaBytes?: number;
  lastSavedAt?: number;
}

export class AppDatabase extends Dexie {
  conversations!: Table<ConversationNode, string>;
  messages!: Table<MessageNode, string>;
  topics!: Table<TopicNode, string>;
  trajectories!: Table<TrajectoryNode, string>;
  skills!: Table<SkillNode, string>;
  memories!: Table<MemoryNode, string>;
  artifacts!: Table<ArtifactNode, string>;
  project_docs!: Table<ProjectDocNode, string>;
  metadata!: Table<MetaRecord, string>;
  settings!: Table<SettingRecord, string>;
  sessions!: Table<SessionRecord, string>;

  constructor() {
    super('SyncopatedContextCompilerDB');
    this.version(1).stores({
      conversations: 'id, source, title, project_id, created_at',
      messages: 'id, conversation_id, role, source, timestamp',
      topics: 'id, label',
      trajectories: 'id, quality_signal',
      skills: 'id, title, version, gitagent_path',
      memories: 'id, source, timestamp',
      artifacts: 'id, message_id, conversation_id, type',
      project_docs: 'id, project_id, filename',
      metadata: 'key, updatedAt',
      settings: 'key, updatedAt'
    });

    this.version(2).stores({
      sessions: 'key, category, updatedAt, createdAt'
    });
  }
}

export const db = new AppDatabase();

/**
 * Saves an entire ConvoGraph atomically into IndexedDB using Dexie transaction
 */
export async function saveFullGraph(graph: ConvoGraph): Promise<void> {
  const convoList = Object.values(graph.conversations || {});
  const msgList = Object.values(graph.messages || {});
  const topicList = Object.values(graph.topics || {});
  const trajList = Object.values(graph.trajectories || {});
  const skillList = Object.values(graph.skills || {});
  const memList = Object.values(graph.memories || {});
  const artList = Object.values(graph.artifacts || {});
  const docList = Object.values(graph.project_docs || {});

  await db.transaction('rw', [
    db.conversations,
    db.messages,
    db.topics,
    db.trajectories,
    db.skills,
    db.memories,
    db.artifacts,
    db.project_docs,
    db.metadata
  ], async () => {
    // Clear and repopulate to ensure exact sync
    await db.conversations.clear();
    await db.messages.clear();
    await db.topics.clear();
    await db.trajectories.clear();
    await db.skills.clear();
    await db.memories.clear();
    await db.artifacts.clear();
    await db.project_docs.clear();

    if (convoList.length > 0) await db.conversations.bulkPut(convoList);
    if (msgList.length > 0) await db.messages.bulkPut(msgList);
    if (topicList.length > 0) await db.topics.bulkPut(topicList);
    if (trajList.length > 0) await db.trajectories.bulkPut(trajList);
    if (skillList.length > 0) await db.skills.bulkPut(skillList);
    if (memList.length > 0) await db.memories.bulkPut(memList);
    if (artList.length > 0) await db.artifacts.bulkPut(artList);
    if (docList.length > 0) await db.project_docs.bulkPut(docList);

    await db.metadata.put({
      key: 'graph_meta',
      value: graph.meta,
      updatedAt: Date.now()
    });
  });
}

/**
 * Loads the full ConvoGraph from Dexie IndexedDB
 */
export async function loadFullGraph(): Promise<ConvoGraph | null> {
  try {
    const convoCount = await db.conversations.count();
    const msgCount = await db.messages.count();

    if (convoCount === 0 && msgCount === 0) {
      return null;
    }

    const [
      convos,
      msgs,
      topics,
      trajectories,
      skills,
      memories,
      artifacts,
      projectDocs,
      metaRecord
    ] = await Promise.all([
      db.conversations.toArray(),
      db.messages.toArray(),
      db.topics.toArray(),
      db.trajectories.toArray(),
      db.skills.toArray(),
      db.memories.toArray(),
      db.artifacts.toArray(),
      db.project_docs.toArray(),
      db.metadata.get('graph_meta')
    ]);

    const graph: ConvoGraph = createEmptyGraph();

    msgs.forEach(m => { graph.messages[m.id] = m; });
    convos.forEach(c => { graph.conversations[c.id] = c; });
    topics.forEach(t => { graph.topics[t.id] = t; });
    trajectories.forEach(t => { graph.trajectories[t.id] = t; });
    skills.forEach(s => { graph.skills[s.id] = s; });
    memories.forEach(m => { graph.memories[m.id] = m; });
    artifacts.forEach(a => { graph.artifacts[a.id] = a; });
    projectDocs.forEach(d => { graph.project_docs[d.id] = d; });

    if (metaRecord && metaRecord.value) {
      graph.meta = metaRecord.value;
    } else {
      graph.meta.imported_at = Date.now();
    }

    // Ensure metadata counts match loaded tables
    graph.meta.stats = {
      message_count: msgs.length,
      conversation_count: convos.length,
      rated_count: convos.filter(c => c.rating !== null).length,
      artifact_count: artifacts.length,
      project_doc_count: projectDocs.length,
      topic_count: topics.length,
      skill_count: skills.length,
      memory_count: memories.length
    };

    return graph;
  } catch (err) {
    console.error('Failed to load ConvoGraph from Dexie:', err);
    return null;
  }
}

/**
 * Updates a conversation rating & notes in Dexie and updates metadata stats
 */
export async function updateConversationRatingInDb(
  id: string, 
  rating: ConversationRating | null, 
  notes: string
): Promise<void> {
  await db.transaction('rw', [db.conversations, db.metadata], async () => {
    const convo = await db.conversations.get(id);
    if (convo) {
      await db.conversations.update(id, { rating, notes });
    }

    const ratedCount = await db.conversations.filter(c => c.rating !== null).count();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.rated_count = ratedCount;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Bulk adds compiled trajectories
 */
export async function addTrajectoriesToDb(trajectories: TrajectoryNode[]): Promise<void> {
  if (trajectories.length === 0) return;
  await db.trajectories.bulkPut(trajectories);
  await db.metadata.put({
    key: 'last_trajectory_sync',
    value: { count: trajectories.length },
    updatedAt: Date.now()
  });
}

/**
 * Bulk adds distilled skills
 */
export async function addSkillsToDb(skills: SkillNode[]): Promise<void> {
  if (skills.length === 0) return;
  await db.transaction('rw', [db.skills, db.metadata], async () => {
    await db.skills.bulkPut(skills);
    const skillCount = await db.skills.count();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.skill_count = skillCount;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Bulk adds project docs
 */
export async function addProjectDocsToDb(docs: ProjectDocNode[]): Promise<void> {
  if (docs.length === 0) return;
  await db.transaction('rw', [db.project_docs, db.metadata], async () => {
    await db.project_docs.bulkPut(docs);
    const docCount = await db.project_docs.count();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.project_doc_count = docCount;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Bulk adds or updates memories in Dexie and updates metadata
 */
export async function addMemoriesToDb(memories: MemoryNode[]): Promise<void> {
  if (memories.length === 0) return;
  await db.transaction('rw', [db.memories, db.metadata], async () => {
    await db.memories.bulkPut(memories);
    const count = await db.memories.count();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.memory_count = count;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Updates a single memory in Dexie
 */
export async function updateMemoryInDb(memory: MemoryNode): Promise<void> {
  await db.memories.put(memory);
}

/**
 * Deletes a single memory from Dexie
 */
export async function deleteMemoryFromDb(id: string): Promise<void> {
  await db.transaction('rw', [db.memories, db.metadata], async () => {
    await db.memories.delete(id);
    const count = await db.memories.count();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.memory_count = count;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Clears all memories from Dexie
 */
export async function clearMemoriesInDb(): Promise<void> {
  await db.transaction('rw', [db.memories, db.metadata], async () => {
    await db.memories.clear();
    const metaRecord = await db.metadata.get('graph_meta');
    if (metaRecord) {
      const currentMeta: GraphMeta = metaRecord.value;
      currentMeta.stats.memory_count = 0;
      await db.metadata.put({
        key: 'graph_meta',
        value: currentMeta,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Clears all data from IndexedDB
 */
export async function clearAllDatabase(): Promise<void> {
  await Promise.all([
    db.conversations.clear(),
    db.messages.clear(),
    db.topics.clear(),
    db.trajectories.clear(),
    db.skills.clear(),
    db.memories.clear(),
    db.artifacts.clear(),
    db.project_docs.clear(),
    db.metadata.clear(),
    db.settings.clear(),
    db.sessions.clear()
  ]);
}

/**
 * Retrieves storage counts and browser storage estimates
 */
export async function getStorageStats(): Promise<StorageStats> {
  const [
    conversations,
    messages,
    topics,
    trajectories,
    skills,
    artifacts,
    projectDocs,
    memories,
    sessions,
    metaRecord
  ] = await Promise.all([
    db.conversations.count(),
    db.messages.count(),
    db.topics.count(),
    db.trajectories.count(),
    db.skills.count(),
    db.artifacts.count(),
    db.project_docs.count(),
    db.memories.count(),
    db.sessions.count(),
    db.metadata.get('graph_meta')
  ]);

  let storageEstimateBytes: number | undefined;
  let quotaBytes: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      storageEstimateBytes = estimate.usage;
      quotaBytes = estimate.quota;
    } catch {
      // Storage estimation not supported or restricted
    }
  }

  return {
    conversations,
    messages,
    topics,
    trajectories,
    skills,
    artifacts,
    projectDocs,
    memories,
    sessions,
    storageEstimateBytes,
    quotaBytes,
    lastSavedAt: metaRecord?.updatedAt
  };
}
