import { ConvoGraph, TrajectoryNode, SkillNode } from '../../types/graph';
import { ModelProvider, TaskModelConfig } from '../../types/provider';

export async function distillSkills(
  graph: ConvoGraph,
  getProvider: (id: string) => ModelProvider | undefined,
  apiKeys: Record<string, string>,
  weakConfig: TaskModelConfig,
  strongConfig: TaskModelConfig,
  topicId: string
): Promise<SkillNode[]> {
  const trajectories = Object.values(graph.trajectories).filter(t => {
    return (t.conversation_ids || []).some(cId => graph.topics[topicId]?.conversation_ids?.includes(cId));
  });

  if (trajectories.length === 0) return [];

  const weakProvider = getProvider(weakConfig.providerId);
  const strongProvider = getProvider(strongConfig.providerId);

  if (!weakProvider || !strongProvider) {
    throw new Error('Missing provider for distillation');
  }

  // Step 1: Weak agent distillation
  const weakDraft = await consolidateLessons(
    trajectories, 
    weakProvider, 
    apiKeys[weakConfig.providerId],
    weakConfig.modelId,
    'WEAK_AGENT_DRAFT'
  );

  // Step 2: Strong agent distillation
  const strongDraft = await consolidateLessons(
    trajectories, 
    strongProvider, 
    apiKeys[strongConfig.providerId],
    strongConfig.modelId,
    'STRONG_AGENT_DRAFT'
  );

  // Step 3: Final consolidation (Contrastive Distillation)
  const finalContent = await contrastiveConsolidate(
    weakDraft,
    strongDraft,
    strongProvider,
    apiKeys[strongConfig.providerId],
    strongConfig.modelId,
    graph.skills[topicId]?.content
  );

  const skillId = topicId.toLowerCase().replace(/\s+/g, '-');
  const skill: SkillNode = {
    id: skillId,
    title: graph.topics[topicId]?.label || topicId,
    content: finalContent,
    source_trajectory_ids: trajectories.map(t => t.id),
    version: (graph.skills[skillId]?.version || 0) + 1,
    gitagent_path: `skills/${skillId}/SKILL.md`,
  };

  return [skill];
}

async function consolidateLessons(
  trajectories: TrajectoryNode[],
  provider: ModelProvider,
  apiKey: string | undefined,
  modelId: string,
  context: string,
  existingContent?: string
): Promise<string> {
  const system = `You are a Skill Distiller (${context}).
Consolidate trajectory lessons into a single gitagent-compatible SKILL.md file.
Follow the standard SKILL.md format with frontmatter and sections.`;

  const user = `
${existingContent ? `EXISTING SKILL CONTENT:\n${existingContent}\n---` : ''}
TRAJECTORY LESSONS:
${trajectories.map(t => `
QUALITY: ${t.quality_signal}
LESSON: ${t.lesson}
`).join('\n---')}
`;

  const result = await provider.generate({ system, user }, apiKey, modelId);
  return result.text;
}

async function contrastiveConsolidate(
  weakDraft: string,
  strongDraft: string,
  provider: ModelProvider,
  apiKey: string | undefined,
  modelId: string,
  existingContent?: string
): Promise<string> {
  const system = `You are a Senior Skill Architect. 
You have two drafts of a SKILL.md file: one from a weak agent and one from a strong agent.
Your task is to perform CONTRASTIVE DISTILLATION:
1. Identify where the weak agent missed nuances that the strong agent caught.
2. Identify if the weak agent provided simpler, more direct instructions that are valuable.
3. Consolidate into a final, high-quality gitagent-compatible SKILL.md.
Follow the Trace2Skill pattern strictly.`;

  const user = `
WEAK AGENT DRAFT:
${weakDraft}

STRONG AGENT DRAFT:
${strongDraft}

${existingContent ? `EXISTING SKILL CONTENT:\n${existingContent}` : ''}
`;

  const result = await provider.generate({ system, user }, apiKey, modelId);
  return result.text;
}
