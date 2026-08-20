import { ConvoGraph, MessageNode, ConversationNode, MemoryNode } from '../../types/graph';

export interface ArtifactInput {
  id: string;
  type: string;
  language?: string;
  title?: string;
  content: string;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: ArtifactInput | any }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] };

export interface ProjectDoc {
  uuid: string;
  filename: string;
  content: string;
  created_at: string;
}

// Claude Format Types
interface ClaudeMessage {
  uuid: string;
  sender: 'human' | 'assistant';
  text: string;
  created_at: string;
  content?: ContentBlock[];
}

interface ClaudeConversation {
  uuid: string;
  name: string | null;
  created_at: string;
  chat_messages: ClaudeMessage[];
}

interface ClaudeProject {
  uuid: string;
  name: string;
  description: string;
  conversations: string[]; // uuids
  docs?: ProjectDoc[];
}

interface ClaudeMemory {
  uuid: string;
  content: string;
  created_at: string;
}

// ChatGPT Format Types
interface ChatGPTMessage {
  id: string;
  message?: {
    author: { role: 'user' | 'assistant' | 'system' };
    content: { parts: string[] };
    create_time: number;
  };
  parent: string | null;
  children: string[];
}

interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  mapping: Record<string, ChatGPTMessage>;
  current_node?: string;
}

// Mistral Format Types
interface MistralMessage {
  id: string;
  chatId: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
}

export function createEmptyGraph(): ConvoGraph {
  return {
    messages: {},
    conversations: {},
    topics: {},
    trajectories: {},
    skills: {},
    memories: {},
    artifacts: {},
    project_docs: {},
    meta: {
      imported_at: Date.now(),
      version: '1.0',
      stats: {
        message_count: 0,
        conversation_count: 0,
        rated_count: 0,
        artifact_count: 0,
        project_doc_count: 0,
        topic_count: 0,
        skill_count: 0
      },
    },
  };
}

function safeJsonParse(json: string, fileName: string): any {
  let trimmed = json.trim();
  
  // Remove possible UTF-8 BOM
  if (trimmed.charCodeAt(0) === 0xFEFF) {
    trimmed = trimmed.slice(1);
  }

  // Attempt to strip comments if initial parse fails
  const attemptParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e: any) {
      return { error: e };
    }
  };

  let result = attemptParse(trimmed);
  if (!result.error) return result;

  // If failed, try stripping comments
  // Removing comments via regex while respecting strings
  const stripComments = (str: string) => {
    return str.replace(/\\"|"(?:\\"|[^"])*"|(\/\*[\s\S]*?\*\/|\/\/.*$)/gm, (match, group1) => {
      if (group1) return ""; // it's a comment
      return match; // it's a string or escaped quote
    });
  };

  const withoutComments = stripComments(trimmed).trim();
  
  result = attemptParse(withoutComments);
  if (!result.error) return result;

  // Fallback recovery for trailing junk
  if (result.error.message.includes('Unexpected non-whitespace character') || 
      result.error.message.includes('Unexpected token')) {
    
    for (let i = trimmed.length - 1; i > 0; i--) {
      const char = trimmed[i];
      if (char === ']' || char === '}') {
        const potentialJson = trimmed.slice(0, i + 1);
        const innerResult = attemptParse(potentialJson);
        if (!innerResult.error) return innerResult;
        
        // Also try potentialJson without comments
        const innerResult2 = attemptParse(stripComments(potentialJson).trim());
        if (!innerResult2.error) return innerResult2;
      }
    }
  }
  
  throw new Error(`Failed to parse ${fileName}: ${result.error.message}`);
}

export function parseClaudeExport(
  conversationsJson: string,
  projectsJson?: string,
  memoriesJson?: string
): ConvoGraph {
  const graph = createEmptyGraph();
  
  const rawConversations = safeJsonParse(conversationsJson, 'conversations.json');
  
  const conversations: ClaudeConversation[] = Array.isArray(rawConversations) ? rawConversations : [];
  
  let rawProjects = [];
  if (projectsJson) {
    try {
      const parsed = safeJsonParse(projectsJson, 'projects.json');
      rawProjects = Array.isArray(parsed) ? parsed : (parsed?.projects || []);
    } catch (e) {
      console.warn('Failed to parse projects.json');
    }
  }
  const projects: ClaudeProject[] = Array.isArray(rawProjects) ? rawProjects : [];

  let rawMemories = [];
  if (memoriesJson) {
    try {
      const parsed = safeJsonParse(memoriesJson, 'memories.json');
      rawMemories = Array.isArray(parsed) ? parsed : (parsed?.memories || []);
    } catch (e) {
      console.warn('Failed to parse memories.json');
    }
  }
  const memories: ClaudeMemory[] = Array.isArray(rawMemories) ? rawMemories : [];

  // Map conversations to projects
  const convoToProject = new Map<string, string>();
  projects.forEach((p) => {
    if (!p) return;
    p.conversations?.forEach((cId) => convoToProject.set(cId, p.uuid));

    if (p.docs && Array.isArray(p.docs)) {
      p.docs.forEach((doc) => {
        if (!doc) return;
        graph.project_docs[doc.uuid] = {
          id: doc.uuid,
          project_id: p.uuid,
          filename: doc.filename,
          content: doc.content,
          created_at: doc.created_at,
        };
      });
    }
  });

  conversations.forEach((c) => {
    if (!c) return;
    const messageIds: string[] = [];
    const seenMsgIds = new Set<string>();
    
    c.chat_messages?.forEach((m, idx) => {
      if (!m) return;
      const mId = `claude-${m.uuid || `${c.uuid}-${idx}`}`;
      if (seenMsgIds.has(mId)) return;
      seenMsgIds.add(mId);
      let content = m.text || '';
      const artifact_ids: string[] = [];

      if (m.content && Array.isArray(m.content) && m.content.length > 0) {
        const textBlocks = m.content
          .filter((b) => b && b.type === 'text')
          .map((b) => (b as { text: string }).text);
        if (textBlocks.length > 0) {
          content = textBlocks.join('\n\n');
        }

        m.content.forEach((block) => {
          if (block && block.type === 'tool_use' && block.name === 'artifacts') {
            const input = block.input as ArtifactInput;
            if (input && input.id) {
              graph.artifacts[input.id] = {
                id: input.id,
                message_id: mId,
                conversation_id: c.uuid,
                project_id: convoToProject.get(c.uuid) || null,
                type: input.type,
                language: input.language,
                title: input.title,
                content: input.content,
              };
              artifact_ids.push(input.id);
            }
          }
        });
      }

      const node: MessageNode = {
        id: mId,
        source: 'claude',
        role: m.sender === 'human' ? 'user' : 'assistant',
        content,
        timestamp: m.created_at ? new Date(m.created_at).getTime() : null,
        conversation_id: c.uuid,
        project_id: convoToProject.get(c.uuid) || null,
        topic_ids: [],
        skill_ids: [],
        artifact_ids: artifact_ids.length > 0 ? artifact_ids : undefined,
      };
      graph.messages[mId] = node;
      messageIds.push(mId);
    });

    graph.conversations[c.uuid] = {
      id: c.uuid,
      source: 'claude',
      title: c.name,
      project_id: convoToProject.get(c.uuid) || null,
      messages: messageIds,
      rating: null,
      notes: '',
      created_at: c.created_at ? new Date(c.created_at).getTime() : null,
    };
  });

  memories.forEach((m) => {
    if (!m) return;
    graph.memories[m.uuid] = {
      id: m.uuid,
      source: 'claude_memories',
      content: m.content,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : null,
    };
  });

  updateStats(graph);
  return graph;
}

export function parseChatGPTExport(conversationsJson: string): ConvoGraph {
  const graph = createEmptyGraph();
  const conversations: ChatGPTConversation[] = safeJsonParse(conversationsJson, 'conversations.json');

  conversations.forEach((c) => {
    const messageIds: string[] = [];
    
    // ChatGPT uses a tree structure
    // Prefer current_node if available, otherwise find a leaf
    const nodes = Object.values(c.mapping);
    let targetNodeId = c.current_node;
    
    if (!targetNodeId) {
      const leafNode = nodes.find(n => n.children.length === 0);
      targetNodeId = leafNode?.id;
    }
    
    if (!targetNodeId) return;

    let current: ChatGPTMessage | undefined = c.mapping[targetNodeId];
    const thread: ChatGPTMessage[] = [];
    while (current) {
      if (current.message && current.message.author.role !== 'system') {
        thread.push(current);
      }
      current = current.parent ? c.mapping[current.parent] : undefined;
    }
    thread.reverse();

    thread.forEach((m) => {
      if (!m.message) return;
      const mId = `chatgpt-${m.id}`;
      
      // Defensively parse content parts
      let content = '';
      if (m.message.content && Array.isArray(m.message.content.parts)) {
        content = m.message.content.parts
          .filter(p => typeof p === 'string' || (p && typeof p === 'object'))
          .map(p => typeof p === 'string' ? p : JSON.stringify(p))
          .join('\n');
      } else if (m.message.content && (m.message.content as any).text) {
        content = (m.message.content as any).text;
      }
      
      const node: MessageNode = {
        id: mId,
        source: 'chatgpt',
        role: m.message.author.role === 'user' ? 'user' : 'assistant',
        content: content || 'Source formatting error in segment',
        timestamp: m.message.create_time ? m.message.create_time * 1000 : null,
        conversation_id: c.id,
        project_id: null,
        topic_ids: [],
        skill_ids: [],
      };
      graph.messages[mId] = node;
      messageIds.push(mId);
    });

    graph.conversations[c.id] = {
      id: c.id,
      source: 'chatgpt',
      title: c.title,
      project_id: null,
      messages: messageIds,
      rating: null,
      notes: '',
      created_at: c.create_time ? c.create_time * 1000 : null,
    };
  });

  updateStats(graph);
  return graph;
}

export function parseMistralExport(conversationsJson: string): ConvoGraph {
  const graph = createEmptyGraph();
  let messages: MistralMessage[] = [];
  
  const parsed = safeJsonParse(conversationsJson, 'conversations.json');
  messages = Array.isArray(parsed) ? parsed : [];

  // Sort by date ascending to ensure proper thread order
  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Group by chatId and deduplicate messages
  const chats = new Map<string, MistralMessage[]>();
  const seenIds = new Set<string>();

  messages.forEach(m => {
    if (!m.chatId || !m.id) return;
    
    // Check if we've already seen this message ID in this chat
    const compositeId = `${m.chatId}-${m.id}`;
    if (seenIds.has(compositeId)) return;
    seenIds.add(compositeId);

    if (!chats.has(m.chatId)) chats.set(m.chatId, []);
    chats.get(m.chatId)!.push(m);
  });

  chats.forEach((chatMessages, chatId) => {
    const messageIds: string[] = [];
    let firstUserContent = '';

    chatMessages.forEach(m => {
      const mId = `mistral-${m.id}`;
      const node: MessageNode = {
        id: mId,
        source: 'mistral',
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt).getTime(),
        conversation_id: chatId,
        project_id: null,
        topic_ids: [],
        skill_ids: [],
      };
      
      if (!firstUserContent && m.role === 'user') {
        firstUserContent = m.content;
      }
      
      graph.messages[mId] = node;
      messageIds.push(mId);
    });

    graph.conversations[chatId] = {
      id: chatId,
      source: 'mistral',
      title: firstUserContent ? (firstUserContent.slice(0, 40) + (firstUserContent.length > 40 ? '...' : '')) : `Mistral Chat ${chatId.slice(0, 8)}`,
      project_id: null,
      messages: messageIds,
      rating: null,
      notes: '',
      created_at: chatMessages.length > 0 ? new Date(chatMessages[0].createdAt).getTime() : null,
    };
  });

  updateStats(graph);
  return graph;
}

function updateStats(graph: ConvoGraph) {
  graph.meta.stats.message_count = Object.keys(graph.messages).length;
  graph.meta.stats.conversation_count = Object.keys(graph.conversations).length;
  graph.meta.stats.rated_count = Object.values(graph.conversations).filter(c => c.rating !== null).length;
  graph.meta.stats.artifact_count = Object.keys(graph.artifacts).length;
  graph.meta.stats.project_doc_count = Object.keys(graph.project_docs).length;
  graph.meta.stats.topic_count = Object.keys(graph.topics).length;
  graph.meta.stats.skill_count = Object.keys(graph.skills).length;
}
