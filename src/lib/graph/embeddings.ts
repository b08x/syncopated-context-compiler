/**
 * Simple browser-native TF-IDF vector implementation for v1.
 * Forward-compatible with TurboQuant online quantization.
 */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function computeTF(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1;
  });
  const total = tokens.length;
  Object.keys(tf).forEach((t) => {
    tf[t] = tf[t] / total;
  });
  return tf;
}

export function computeCosineSimilarity(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

// Simple vocabulary-based vectorization
export class Vectorizer {
  private vocabulary: Map<string, number> = new Map();
  private nextId = 0;

  fit(texts: string[]) {
    texts.forEach((text) => {
      tokenize(text).forEach((token) => {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.nextId++);
        }
      });
    });
  }

  vectorize(text: string): number[] {
    const vector = new Array(this.vocabulary.size).fill(0);
    const tf = computeTF(tokenize(text));
    Object.entries(tf).forEach(([token, value]) => {
      const id = this.vocabulary.get(token);
      if (id !== undefined) {
        vector[id] = value;
      }
    });
    return vector;
  }
}
