-- AlterTable
ALTER TABLE "NewsArticle"
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "DailyDigest"
ADD COLUMN     "modelVersion" TEXT;

-- AlterTable
ALTER TABLE "AiLog"
ADD COLUMN     "modelVersion" TEXT;

-- AlterTable
ALTER TABLE "AdminAiJob"
ADD COLUMN     "modelVersion" TEXT;

-- CreateTable
CREATE TABLE "ArticleProvenance" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "jobId" TEXT,
    "kind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "action" TEXT,
    "model" TEXT,
    "modelVersion" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsArticle_published_publishedAt_idx" ON "NewsArticle"("published", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "NewsArticle_scheduledPublishAt_idx" ON "NewsArticle"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "NewsArticle_version_idx" ON "NewsArticle"("version");

-- CreateIndex
CREATE INDEX "ArticleProvenance_articleId_idx" ON "ArticleProvenance"("articleId");

-- CreateIndex
CREATE INDEX "ArticleProvenance_articleId_kind_createdAt_idx" ON "ArticleProvenance"("articleId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleProvenance_jobId_idx" ON "ArticleProvenance"("jobId");

-- CreateIndex
CREATE INDEX "ArticleProvenance_kind_idx" ON "ArticleProvenance"("kind");

-- CreateIndex
CREATE INDEX "ArticleProvenance_sourceType_idx" ON "ArticleProvenance"("sourceType");

-- CreateIndex
CREATE INDEX "ArticleProvenance_model_modelVersion_idx" ON "ArticleProvenance"("model", "modelVersion");

-- CreateIndex
CREATE INDEX "ArticleProvenance_createdAt_idx" ON "ArticleProvenance"("createdAt");

-- AddForeignKey
ALTER TABLE "ArticleProvenance" ADD CONSTRAINT "ArticleProvenance_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleProvenance" ADD CONSTRAINT "ArticleProvenance_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
