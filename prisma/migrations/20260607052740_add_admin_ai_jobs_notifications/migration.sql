-- DropIndex
DROP INDEX "ArticleEmbedding_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "AdminAiJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "title" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "jobId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAiJob_status_createdAt_idx" ON "AdminAiJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAiJob_type_idx" ON "AdminAiJob"("type");

-- CreateIndex
CREATE INDEX "AdminAiJob_createdAt_idx" ON "AdminAiJob"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_status_createdAt_idx" ON "AdminNotification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_jobId_idx" ON "AdminNotification"("jobId");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex
CREATE INDEX "ManagerChatMessage_createdAt_idx" ON "ManagerChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ManagerChatMessage_jobId_idx" ON "ManagerChatMessage"("jobId");

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerChatMessage" ADD CONSTRAINT "ManagerChatMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
