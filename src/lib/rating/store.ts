import { ConversationRating } from '../../types/graph';
import { SessionStats } from '../../types/rating';

export function calculateSessionStats(ratings: Map<string, ConversationRating>): SessionStats {
  const stats: SessionStats = {
    total: ratings.size,
    rated: 0,
    correct: 0,
    fail: 0,
    issues: 0,
  };

  ratings.forEach((r) => {
    stats.rated++;
    if (r.correctness === 'correct') stats.correct++;
    if (r.correctness === 'fail') stats.fail++;
    if (r.tone === 'issues' || r.format === 'bad') stats.issues++;
  });

  return stats;
}

export function createInitialRating(existing?: Partial<ConversationRating>): ConversationRating {
  return {
    correctness: existing?.correctness ?? null,
    tone: existing?.tone ?? null,
    format: existing?.format ?? null,
    style_tags: existing?.style_tags ?? [],
    intent: existing?.intent ?? null,
    distillable: existing?.distillable ?? null,
    relevance: existing?.relevance ?? 0,
    domain: existing?.domain ?? null,
    rated_at: Date.now(),
  };
}
