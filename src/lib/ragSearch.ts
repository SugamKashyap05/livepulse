import { prisma } from '@/lib/db';
import { embedText } from '@/lib/ollama';
import type { SemanticResult, BM25Result, HybridResult } from './ragTypes';

/**
 * Hybrid search combining semantic (vector) and BM25 (full-text) retrieval.
 * Results are fused using Reciprocal Rank Fusion (RRF).
 *
 * Adaptations from spec:
 * - Uses `embedText(query, "query")` instead of `generateEmbedding` (actual API)
 * - Uses `description` instead of `content` (NewsArticle schema)
 * - Uses `link` instead of `url` (NewsArticle schema)
 * - Filters on `a.visible = true` (not `a.published`) for RAG consistency
 */
export async function hybridSearch(query: string, limit: number = 20): Promise<HybridResult[]> {
  const embedding = await embedText(query, "query");
  const embeddingString = `[${embedding.join(',')}]`;

  const [semanticResults, bm25Results] = await Promise.all([
    prisma.$queryRaw<SemanticResult[]>`
      SELECT 
        a.id, a.title, a.description, a.summary, 
        a."sourceQualityScore", COALESCE(a."publishedAt", a."pubDate") as "publishedAt", a."ingestedAt", a.link,
        1 - (e.embedding <=> ${embeddingString}::vector) as "semanticScore"
      FROM "NewsArticle" a
      JOIN "ArticleEmbedding" e ON e."articleId" = a.id
      WHERE e.superseded IS NOT TRUE
        AND a.visible = true
      ORDER BY e.embedding <=> ${embeddingString}::vector
      LIMIT ${limit}
    `,
    prisma.$queryRaw<BM25Result[]>`
      SELECT 
        a.id, a.title, a.description, a.summary,
        a."sourceQualityScore", COALESCE(a."publishedAt", a."pubDate") as "publishedAt", a."ingestedAt", a.link,
        ts_rank(a."searchVector", websearch_to_tsquery('english', ${query})) as "bm25Score"
      FROM "NewsArticle" a
      WHERE a."searchVector" @@ websearch_to_tsquery('english', ${query})
        AND a.visible = true
      ORDER BY "bm25Score" DESC
      LIMIT ${limit}
    `
  ]);

  return reciprocalRankFusion(semanticResults, bm25Results);
}

function reciprocalRankFusion(
  semantic: SemanticResult[],
  bm25: BM25Result[],
  k = 60
): HybridResult[] {
  const scores = new Map<string, number>();
  const articles = new Map<string, Omit<HybridResult, 'rrfScore'>>();

  semantic.forEach((r, rank) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + rank + 1));
    articles.set(r.id, { ...r });
  });

  bm25.forEach((r, rank) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + rank + 1));
    const existing = articles.get(r.id);
    if (existing) {
      articles.set(r.id, { ...existing, bm25Score: r.bm25Score });
    } else {
      articles.set(r.id, { ...r });
    }
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, rrfScore]) => {
      const article = articles.get(id)!;
      return {
        id: article.id,
        title: article.title,
        description: article.description,
        summary: article.summary,
        sourceQualityScore: article.sourceQualityScore,
        publishedAt: article.publishedAt,
        ingestedAt: article.ingestedAt,
        link: article.link,
        semanticScore: article.semanticScore,
        bm25Score: article.bm25Score,
        rrfScore,
      };
    });
}
