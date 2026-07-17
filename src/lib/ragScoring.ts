import type { HybridResult, ChunkConfidence, ScoredChunk } from './ragTypes';

// Expose as admin-configurable — hardcoded for now,
// move to DB config table in Research Library room later
export const CONFIDENCE_THRESHOLD = 0.45;

const WEIGHTS = {
  trust: 0.25,
  freshness: 0.30,
  quality: 0.25,
  consistency: 0.20,
} as const;

export function scoreChunk(article: HybridResult): ChunkConfidence {
  // Freshness: full score under 24h, linear decay to 0 at 30 days
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  const freshnessScore = Math.max(0, 1 - ageHours / 720);

  // Trust and quality from source tier assigned at ingestion
  const trustScore = article.sourceQualityScore ?? 0.5;
  const sourceQualityScore = trustScore;

  // Consistency: did both retrieval paths return this article?
  // RRF score > 0.02 indicates presence in both semantic and BM25
  const retrievalConsistencyScore = Math.min(1, article.rrfScore / 0.02);

  const compositeScore =
    trustScore * WEIGHTS.trust +
    freshnessScore * WEIGHTS.freshness +
    sourceQualityScore * WEIGHTS.quality +
    retrievalConsistencyScore * WEIGHTS.consistency;

  return {
    trustScore,
    freshnessScore,
    sourceQualityScore,
    retrievalConsistencyScore,
    compositeScore,
    passesThreshold: compositeScore >= CONFIDENCE_THRESHOLD,
  };
}

export function scoreChunks(articles: HybridResult[]): ScoredChunk[] {
  return articles.map(a => ({ ...a, confidence: scoreChunk(a) }));
}

export function filterTrustedChunks(scored: ScoredChunk[]): ScoredChunk[] {
  return scored.filter(c => c.confidence.passesThreshold);
}

export function averageConfidence(chunks: ScoredChunk[]): number {
  if (chunks.length === 0) return 0;
  return chunks.reduce((s, c) => s + c.confidence.compositeScore, 0) / chunks.length;
}
