import { ConversationRating } from './graph';

export interface SessionStats {
  total: number;
  rated: number;
  correct: number;
  fail: number;
  issues: number;
}

export type RatingFilter = 'all' | 'unrated' | 'rated' | 'issues';

export interface RatingState {
  ratings: Map<string, ConversationRating>;
  notes: Map<string, string>;
}
