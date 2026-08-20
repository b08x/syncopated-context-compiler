import { ConvoGraph, TrajectoryNode, ConversationNode } from '../../types/graph';
import { ModelProvider, TaskModelConfig } from '../../types/provider';

export interface CompilationOptions {
  topic_id?: string;
  min_rating_count?: number;
}

export interface CompilationProgress {
  currentGroup: number;
  totalGroups: number;
  groupLabel: string;
  timestamp: number;
  estimatedTimeRemaining?: number; // in ms
}

export async function compileTrajectories(
  graph: ConvoGraph,
  provider: ModelProvider,
  apiKey: string,
  config: TaskModelConfig,
  options: CompilationOptions = {},
  onProgress?: (progress: CompilationProgress) => void
): Promise<TrajectoryNode[]> {
  const ratedConvos = Object.values(graph.conversations).filter(
    (c) => c.rating !== null
  );

  // Group by topic + polarity
  const groups: Record<string, ConversationNode[]> = {};
  ratedConvos.forEach((c) => {
    const topicId = Object.values(graph.topics).find(t => t.conversation_ids?.includes(c.id))?.id || 'default';
    const polarity = c.rating?.correctness === 'correct' ? 'positive' : 'negative';
    const key = `${topicId}-${polarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const trajectories: TrajectoryNode[] = [];
  const groupEntries = Object.entries(groups);
  const totalGroups = groupEntries.length;
  const startTime = Date.now();

  for (let i = 0; i < totalGroups; i++) {
    const [key, convos] = groupEntries[i];
    const [topicId, polarity] = key.split('-');
    const tId = `traj-${key}-${Date.now()}`;
    const currentGroup = i + 1;
    
    if (onProgress) {
      const elapsed = Date.now() - startTime;
      const avgTimePerGroup = i > 0 ? elapsed / i : 0;
      const etr = avgTimePerGroup ? avgTimePerGroup * (totalGroups - i) : undefined;

      onProgress({
        currentGroup,
        totalGroups,
        groupLabel: `${topicId} (${polarity})`,
        timestamp: Date.now(),
        estimatedTimeRemaining: etr
      });
    }

    // Extract lesson via LLM
    const lesson = await extractLesson(convos, provider, apiKey, config.modelId, config.parameters);

    trajectories.push({
      id: tId,
      conversation_ids: convos.map((c) => c.id),
      lesson,
      quality_signal: polarity as 'positive' | 'negative',
      skill_candidates: [],
      source_distribution: convos.reduce((acc, c) => {
        acc[c.source] = (acc[c.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
  }

  return trajectories;
}

async function extractLesson(
  convos: ConversationNode[],
  provider: ModelProvider,
  apiKey: string,
  modelId: string,
  parameters: { temperature: number; maxTokens: number }
): Promise<string> {
  const system = `You are a Trajectory Compiler. Your task is to extract a structured lesson from a set of rated conversation traces.
A trace consists of messages, a rating (correctness, tone, format), and notes.
Output a structured lesson with:
- WHAT WORKED
- WHAT FAILED
- GENERALIZABLE PRINCIPLE`;

  const user = `Analyze these conversation traces:
${convos.map(c => `
CONVERSATION: ${c.title || c.id}
RATING: Correctness: ${c.rating?.correctness}, Tone: ${c.rating?.tone}, Format: ${c.rating?.format}
NOTES: ${c.notes}
MESSAGES:
${c.messages.map(mId => {
  return `[Role] Content...`; 
}).join('\n')}
`).join('\n---')}`;

  const result = await provider.generate({ system, user }, apiKey, modelId);
  return result.text;
}
