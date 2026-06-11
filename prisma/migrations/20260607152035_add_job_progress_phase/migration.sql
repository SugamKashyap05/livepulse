-- DropIndex
DROP INDEX "ArticleEmbedding_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "AdminAiJob" ADD COLUMN     "phase" TEXT,
ADD COLUMN     "progress" INTEGER;

-- CreateIndex
CREATE INDEX "AdminAiJob_status_idx" ON "AdminAiJob"("status");

-- CreateIndex
CREATE INDEX "AdminAiJob_type_status_idx" ON "AdminAiJob"("type", "status");

-- CreateIndex
CREATE INDEX "AdminNotification_status_idx" ON "AdminNotification"("status");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_desc_idx" ON "AdminNotification"("createdAt" DESC);
