import { prisma } from '@/lib/db';
import type { HybridResult, ChunkConfidence, ScoredChunk } from './ragTypes';

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;
export const SEMANTIC_FLOOR = 0.65;

const THRESHOLD_TTL_MS = 5 * 60 * 1000;
let cachedThreshold: number | null = null;
let thresholdCachedAt = 0;

const WEIGHTS = {
  trust: 0.25,
  freshness: 0.30,
  quality: 0.25,
  consistency: 0.20,
} as const;

function normalizeThreshold(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed) || parsed < 0.1 || parsed > 0.9) {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
  return parsed;
}

export async function getConfidenceThreshold(): Promise<number> {
  try {
    const config = await prisma.adminConfig.findUnique({
      where: { key: 'RAG_CONFIDENCE_THRESHOLD' },
    });
    return normalizeThreshold(config?.value);
  } catch {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
}

export async function getCachedConfidenceThreshold(): Promise<number> {
  const now = Date.now();
  if (cachedThreshold !== null && now - thresholdCachedAt < THRESHOLD_TTL_MS) {
    return cachedThreshold;
  }

  cachedThreshold = await getConfidenceThreshold();
  thresholdCachedAt = now;
  return cachedThreshold;
}

export function clearConfidenceThresholdCache() {
  cachedThreshold = null;
  thresholdCachedAt = 0;
}

export function scoreChunk(
  article: HybridResult,
  threshold = DEFAULT_CONFIDENCE_THRESHOLD
): ChunkConfidence {
  if ((article.semanticScore ?? 0) < SEMANTIC_FLOOR) {
    return {
      trustScore: 0,
      freshnessScore: 0,
      sourceQualityScore: 0,
      retrievalConsistencyScore: 0,
      compositeScore: 0,
      passesThreshold: false,
    };
  }

  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  const freshnessScore = Math.max(0, 1 - ageHours / 720);

  const trustScore = article.sourceQualityScore ?? 0.5;
  const sourceQualityScore = trustScore;

  const appearedInBoth =
    article.semanticScore !== undefined && article.bm25Score !== undefined;
  const retrievalConsistencyScore = appearedInBoth
    ? Math.min(1, article.rrfScore / 0.02)
    : 0.1;

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
    passesThreshold: compositeScore >= threshold,
  };
}

export function scoreChunks(
  articles: HybridResult[],
  threshold = DEFAULT_CONFIDENCE_THRESHOLD
): ScoredChunk[] {
  return articles.map((article) => ({
    ...article,
    confidence: scoreChunk(article, threshold),
  }));
}

export function filterTrustedChunks(scored: ScoredChunk[]): ScoredChunk[] {
  return scored.filter((chunk) => chunk.confidence.passesThreshold);
}

export function averageConfidence(chunks: ScoredChunk[]): number {
  if (chunks.length === 0) return 0;
  return chunks.reduce((sum, chunk) => sum + chunk.confidence.compositeScore, 0) / chunks.length;
}
