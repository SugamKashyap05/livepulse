-- Phase 2: RAG Pipeline schema additions
-- Non-destructive: ADD COLUMN only + CREATE TABLE. Zero DROP statements.

-- AlterTable: AiLog — add RAG observability fields
ALTER TABLE "AiLog" ADD COLUMN     "avgConfidence" DOUBLE PRECISION,
ADD COLUMN     "chunksRetrieved" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "query" TEXT;

-- AlterTable: ArticleEmbedding — add superseded flag for embedding versioning
ALTER TABLE "ArticleEmbedding" ADD COLUMN     "superseded" BOOLEAN;

-- AlterTable: NewsArticle — add RAG pipeline fields
ALTER TABLE "NewsArticle" ADD COLUMN     "chunkVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "documentType" TEXT NOT NULL DEFAULT 'news_article',
ADD COLUMN     "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sourceQualityScore" DOUBLE PRECISION;

-- CreateTable: RagQueryCache — hybrid search result cache with TTL
CREATE TABLE "RagQueryCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RagQueryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on queryHash for upsert operations
CREATE UNIQUE INDEX "RagQueryCache_queryHash_key" ON "RagQueryCache"("queryHash");
