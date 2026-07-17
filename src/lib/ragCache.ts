import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { hybridSearch } from './ragSearch';
import { scoreChunks, filterTrustedChunks, averageConfidence, getCachedConfidenceThreshold } from './ragScoring';
import type { ScoredChunk } from './ragTypes';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function cachedHybridSearch(
  query: string,
  limit: number = 20
): Promise<{ trusted: ScoredChunk[]; avgConf: number; cached: boolean }> {
  const queryHash = createHash('sha256').update(query).digest('hex');

  // Check cache
  const cached = await prisma.ragQueryCache.findUnique({
    where: { queryHash },
  });

  if (cached && cached.expiresAt > new Date()) {
    // Async increment hit count
    prisma.ragQueryCache.update({
      where: { queryHash },
      data: { hitCount: { increment: 1 } },
    }).catch(console.error);

    return {
      trusted: cached.results as unknown as ScoredChunk[],
      avgConf: cached.avgConfidence,
      cached: true,
    };
  }

  // Cache miss or expired
  const hybridResults = await hybridSearch(query, limit);
  const threshold = await getCachedConfidenceThreshold();
  const scored = scoreChunks(hybridResults, threshold);
  const trusted = filterTrustedChunks(scored);
  const avgConf = averageConfidence(trusted);

  // Save to cache
  await prisma.ragQueryCache.upsert({
    where: { queryHash },
    create: {
      queryHash,
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: trusted as any,
      avgConfidence: avgConf,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      hitCount: 0,
    },
    update: {
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: trusted as any,
      avgConfidence: avgConf,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      hitCount: 0, // reset on refresh?
    },
  });

  return { trusted, avgConf, cached: false };
}
