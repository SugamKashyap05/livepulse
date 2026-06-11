-- AlterTable
ALTER TABLE "AdminAiJob"
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '1',
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "parentJobId" TEXT;

-- CreateIndex
CREATE INDEX "AdminAiJob_status_updatedAt_idx" ON "AdminAiJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AdminAiJob_parentJobId_idx" ON "AdminAiJob"("parentJobId");

-- CreateIndex
CREATE INDEX "AdminAiJob_scheduledFor_idx" ON "AdminAiJob"("scheduledFor");

-- CreateIndex
CREATE INDEX "AdminNotification_status_readAt_createdAt_idx" ON "AdminNotification"("status", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "ManagerChatMessage_jobId_createdAt_idx" ON "ManagerChatMessage"("jobId", "createdAt");
