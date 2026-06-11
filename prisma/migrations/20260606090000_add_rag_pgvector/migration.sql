-- Requires pgvector >= 0.5.0 for HNSW
-- Fallback: replace hnsw with ivfflat if version check fails
-- Verify with: SELECT extversion FROM pg_extension WHERE extname='vector'

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ArticleEmbedding" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "embedding" vector(768) NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingDim" INTEGER NOT NULL,
  "topic" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "pubDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ArticleEmbedding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArticleEmbedding"
ADD CONSTRAINT "ArticleEmbedding_articleId_fkey"
FOREIGN KEY ("articleId")
REFERENCES "NewsArticle"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ArticleEmbedding_articleId_chunkIndex_embeddingModel_key"
ON "ArticleEmbedding"("articleId", "chunkIndex", "embeddingModel");

CREATE INDEX "ArticleEmbedding_articleId_idx" ON "ArticleEmbedding"("articleId");
CREATE INDEX "ArticleEmbedding_topic_idx" ON "ArticleEmbedding"("topic");
CREATE INDEX "ArticleEmbedding_contentHash_idx" ON "ArticleEmbedding"("contentHash");
CREATE INDEX "ArticleEmbedding_embeddingModel_idx" ON "ArticleEmbedding"("embeddingModel");
CREATE INDEX "ArticleEmbedding_pubDate_idx" ON "ArticleEmbedding"("pubDate");

CREATE INDEX "ArticleEmbedding_embedding_hnsw_idx"
ON "ArticleEmbedding"
USING hnsw ("embedding" vector_cosine_ops);
