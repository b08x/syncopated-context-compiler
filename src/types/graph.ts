export interface MessageNode {
  id: string;
  source: 'claude' | 'chatgpt' | 'mistral';
  role: 'user' | 'assistant';
  content: string;
  timestamp: number | null;
  conversation_id: string;
  project_id: string | null;
  topic_ids: string[];
  skill_ids: string[];
  artifact_ids?: string[];
}

export interface ConversationRating {
  correctness: 'correct' | 'fail' | 'neutral' | null;
  tone: 'good' | 'issues' | 'neutral' | null;
  format: 'good' | 'bad' | 'neutral' | null;
  style_tags: string[];
  intent: 'refactor' | 'architecture' | 'debugging' | 'research' | 'config' | null;
  distillable: 'yes' | 'maybe' | 'no' | null;
  relevance: number;
  domain: 'agent' | 'serialization' | 'prompt' | 'tooling' | 'other' | null;
  rated_at: number;
}

export interface ConversationNode {
  id: string;
  source: 'claude' | 'chatgpt' | 'mistral';
  title: string | null;
  project_id: string | null;
  messages: string[]; // MessageNode ids, ordered
  rating: ConversationRating | null;
  notes: string;
  created_at: number | null;
}

export interface TopicNode {
  id: string;
  label: string;
  conversation_ids: string[];
  centroid_vector: number[]; // Float32Array compatible
}

export interface TrajectoryNode {
  id: string;
  conversation_ids: string[];
  lesson: string;
  quality_signal: 'positive' | 'negative' | 'mixed';
  skill_candidates: string[];
  source_distribution?: Record<string, number>; // Forward compatibility for MemCollab
}

export interface SkillNode {
  id: string;
  title: string;
  content: string;
  source_trajectory_ids: string[];
  version: number;
  gitagent_path: string;
}

export interface MemoryNode {
  id: string;
  source: 'claude_memories';
  content: string;
  timestamp: number | null;
}

export interface ArtifactNode {
  id: string;
  message_id: string;
  conversation_id: string;
  project_id: string | null;
  type: string;
  language?: string;
  title?: string;
  content: string;
}

export interface ProjectDocNode {
  id: string;
  project_id: string;
  filename: string;
  content: string;
  created_at: string;
}

export interface GraphMeta {
  imported_at: number;
  version: string;
  stats: {
    message_count: number;
    conversation_count: number;
    rated_count: number;
    artifact_count: number;
    project_doc_count: number;
    topic_count: number;
    skill_count: number;
  };
}

export interface ConvoGraph {
  messages: Record<string, MessageNode>;
  conversations: Record<string, ConversationNode>;
  topics: Record<string, TopicNode>;
  trajectories: Record<string, TrajectoryNode>;
  skills: Record<string, SkillNode>;
  memories: Record<string, MemoryNode>;
  artifacts: Record<string, ArtifactNode>;
  project_docs: Record<string, ProjectDocNode>;
  meta: GraphMeta;
}
