-- Phase 2: Full-text search vector column and indexes
-- Adapts spec to use "description" instead of "content" (NewsArticle has no content column)

-- Add full-text search vector column (generated, always kept in sync)
ALTER TABLE "NewsArticle" 
ADD COLUMN IF NOT EXISTS "searchVector" tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce("title", '') || ' ' ||
    coalesce("summary", '') || ' ' ||
    coalesce("description", '')
  )
) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "idx_articles_search_vector" 
ON "NewsArticle" USING GIN("searchVector");

-- Composite index for RAG freshness + quality scoring
CREATE INDEX IF NOT EXISTS "idx_articles_published_quality"
ON "NewsArticle" ("publishedAt" DESC, "sourceQualityScore" DESC);

-- Index for hot-path feed queries
CREATE INDEX IF NOT EXISTS "idx_articles_published_at"
ON "NewsArticle" ("publishedAt" DESC);
