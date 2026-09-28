import { ConvoGraph, MessageNode, ConversationNode } from '../../types/graph';
import { createEmptyGraph } from './builder';

interface MarkdownMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ParsedMarkdownSection {
  title: string;
  messages: MarkdownMessage[];
  date?: number;
}

/**
 * Parses markdown conversation exports into ConvoGraph nodes.
 * Supports:
 * - Header-delimited conversation sections (# Conversation Title or ## ...)
 * - Role markers like:
 *   - **User:** / **Human:** / **You:** / ### Human / ### User
 *   - **Assistant:** / **Claude:** / **ChatGPT:** / **AI:** / ### Assistant / ### AI
 * - Single-conversation markdown files as well as multi-conversation transcripts
 */
export function parseMarkdownExport(markdownText: string, filename?: string): ConvoGraph {
  const graph = createEmptyGraph();
  const trimmed = markdownText.trim();
  if (!trimmed) return graph;

  const sections: ParsedMarkdownSection[] = [];

  // Check if file has multiple top-level conversation headings (e.g. # Conversation or --- divider)
  const lines = trimmed.split('\n');
  let currentTitle = filename ? filename.replace(/\.(md|markdown|txt)$/i, '') : 'Imported Conversation';
  let currentMessages: MarkdownMessage[] = [];
  let currentRole: 'user' | 'assistant' | 'system' = 'user';
  let currentContentLines: string[] = [];

  const flushMessage = () => {
    if (currentContentLines.length > 0) {
      const text = currentContentLines.join('\n').trim();
      if (text) {
        currentMessages.push({
          role: currentRole,
          content: text,
        });
      }
      currentContentLines = [];
    }
  };

  const flushSection = () => {
    flushMessage();
    if (currentMessages.length > 0) {
      sections.push({
        title: currentTitle,
        messages: currentMessages,
      });
      currentMessages = [];
    }
  };

  // Regular expressions for role detection
  const userHeaderRegex = /^(?:#{1,4}\s*(?:User|Human|You)|(?:\*{1,2}|_{1,2})(?:User|Human|You)(?:\*{1,2}|_{1,2}):?)\s*(.*)$/i;
  const assistantHeaderRegex = /^(?:#{1,4}\s*(?:Assistant|Claude|ChatGPT|AI|Mistral|Bot)|(?:\*{1,2}|_{1,2})(?:Assistant|Claude|ChatGPT|AI|Mistral|Bot)(?:\*{1,2}|_{1,2}):?)\s*(.*)$/i;
  const systemHeaderRegex = /^(?:#{1,4}\s*(?:System)|(?:\*{1,2}|_{1,2})(?:System)(?:\*{1,2}|_{1,2}):?)\s*(.*)$/i;

  // Multi-conversation divider regex (e.g. # Conversation: Title, or --- with # Title)
  const convoHeaderRegex = /^#\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if new conversation section starts with a single #
    const convoMatch = trimmedLine.match(convoHeaderRegex);
    if (convoMatch && currentMessages.length > 0) {
      flushSection();
      currentTitle = convoMatch[1].trim();
      continue;
    }

    // Check for user role
    const userMatch = trimmedLine.match(userHeaderRegex);
    if (userMatch) {
      flushMessage();
      currentRole = 'user';
      if (userMatch[1]?.trim()) {
        currentContentLines.push(userMatch[1].trim());
      }
      continue;
    }

    // Check for assistant role
    const assistantMatch = trimmedLine.match(assistantHeaderRegex);
    if (assistantMatch) {
      flushMessage();
      currentRole = 'assistant';
      if (assistantMatch[1]?.trim()) {
        currentContentLines.push(assistantMatch[1].trim());
      }
      continue;
    }

    // Check for system role
    const systemMatch = trimmedLine.match(systemHeaderRegex);
    if (systemMatch) {
      flushMessage();
      currentRole = 'system';
      if (systemMatch[1]?.trim()) {
        currentContentLines.push(systemMatch[1].trim());
      }
      continue;
    }

    currentContentLines.push(line);
  }

  // Flush remaining
  flushSection();

  // If no role headers were found, fall back to treating entire document as alternating paragraphs or single exchange
  if (sections.length === 0 || sections.every(s => s.messages.length === 0)) {
    const rawParagraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim());
    const messages: MarkdownMessage[] = [];
    
    rawParagraphs.forEach((p, index) => {
      messages.push({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: p.trim(),
      });
    });

    if (messages.length > 0) {
      sections.push({
        title: currentTitle,
        messages,
      });
    }
  }

  // Convert parsed sections into ConvoGraph nodes
  const now = Date.now();
  sections.forEach((section, sIdx) => {
    const convoId = `md-${now}-${sIdx}-${Math.random().toString(36).slice(2, 7)}`;
    const messageIds: string[] = [];

    section.messages.forEach((msg, mIdx) => {
      const msgId = `md-msg-${convoId}-${mIdx}`;
      const node: MessageNode = {
        id: msgId,
        source: 'markdown',
        role: msg.role,
        content: msg.content,
        timestamp: now + mIdx * 1000,
        conversation_id: convoId,
        project_id: null,
        topic_ids: [],
        skill_ids: [],
      };
      graph.messages[msgId] = node;
      messageIds.push(msgId);
    });

    const firstUserMsg = section.messages.find(m => m.role === 'user');
    let title = section.title;
    if (title === 'Imported Conversation' && firstUserMsg) {
      title = firstUserMsg.content.slice(0, 45).replace(/\n/g, ' ') + (firstUserMsg.content.length > 45 ? '...' : '');
    }

    const convoNode: ConversationNode = {
      id: convoId,
      source: 'markdown',
      title,
      project_id: null,
      messages: messageIds,
      rating: null,
      notes: '',
      created_at: now,
    };

    graph.conversations[convoId] = convoNode;
  });

  // Calculate meta stats
  graph.meta.stats = {
    message_count: Object.keys(graph.messages).length,
    conversation_count: Object.keys(graph.conversations).length,
    rated_count: 0,
    artifact_count: 0,
    project_doc_count: 0,
    topic_count: 0,
    skill_count: 0,
  };

  return graph;
}
