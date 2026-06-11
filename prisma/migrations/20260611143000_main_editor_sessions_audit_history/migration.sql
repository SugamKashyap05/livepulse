-- AlterTable
ALTER TABLE "AdminDepartmentEvent"
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '1';

-- CreateTable
CREATE TABLE "EditorSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'active',
    "department" TEXT,
    "jobId" TEXT,
    "articleId" TEXT,
    "createdBy" TEXT,
    "metadata" JSONB,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorContextRef" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT,
    "department" TEXT,
    "jobId" TEXT,
    "departmentEventId" TEXT,
    "articleId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorContextRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "sessionId" TEXT,
    "messageId" TEXT,
    "jobId" TEXT,
    "departmentEventId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStateTransition" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "fromPhase" TEXT,
    "toPhase" TEXT,
    "event" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_schemaVersion_idx" ON "AdminDepartmentEvent"("schemaVersion");

-- CreateIndex
CREATE INDEX "EditorSession_status_updatedAt_idx" ON "EditorSession"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "EditorSession_scope_status_updatedAt_idx" ON "EditorSession"("scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "EditorSession_department_status_updatedAt_idx" ON "EditorSession"("department", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "EditorSession_jobId_idx" ON "EditorSession"("jobId");

-- CreateIndex
CREATE INDEX "EditorSession_articleId_idx" ON "EditorSession"("articleId");

-- CreateIndex
CREATE INDEX "EditorSession_lastMessageAt_idx" ON "EditorSession"("lastMessageAt");

-- CreateIndex
CREATE INDEX "EditorSession_createdAt_idx" ON "EditorSession"("createdAt");

-- CreateIndex
CREATE INDEX "EditorMessage_sessionId_createdAt_idx" ON "EditorMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "EditorMessage_sessionId_role_createdAt_idx" ON "EditorMessage"("sessionId", "role", "createdAt");

-- CreateIndex
CREATE INDEX "EditorMessage_jobId_createdAt_idx" ON "EditorMessage"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "EditorMessage_createdAt_idx" ON "EditorMessage"("createdAt");

-- CreateIndex
CREATE INDEX "EditorContextRef_sessionId_type_createdAt_idx" ON "EditorContextRef"("sessionId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EditorContextRef_type_targetId_idx" ON "EditorContextRef"("type", "targetId");

-- CreateIndex
CREATE INDEX "EditorContextRef_jobId_idx" ON "EditorContextRef"("jobId");

-- CreateIndex
CREATE INDEX "EditorContextRef_departmentEventId_idx" ON "EditorContextRef"("departmentEventId");

-- CreateIndex
CREATE INDEX "EditorContextRef_articleId_idx" ON "EditorContextRef"("articleId");

-- CreateIndex
CREATE INDEX "EditorContextRef_department_idx" ON "EditorContextRef"("department");

-- CreateIndex
CREATE INDEX "EditorContextRef_createdAt_idx" ON "EditorContextRef"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorType_createdAt_idx" ON "AdminAuditLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_sessionId_createdAt_idx" ON "AdminAuditLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_messageId_idx" ON "AdminAuditLog"("messageId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_jobId_createdAt_idx" ON "AdminAuditLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_departmentEventId_createdAt_idx" ON "AdminAuditLog"("departmentEventId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_jobId_createdAt_idx" ON "JobStateTransition"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_toStatus_createdAt_idx" ON "JobStateTransition"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_event_createdAt_idx" ON "JobStateTransition"("event", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_actorType_createdAt_idx" ON "JobStateTransition"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_actorId_createdAt_idx" ON "JobStateTransition"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStateTransition_createdAt_idx" ON "JobStateTransition"("createdAt");

-- AddForeignKey
ALTER TABLE "EditorSession" ADD CONSTRAINT "EditorSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorMessage" ADD CONSTRAINT "EditorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EditorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorMessage" ADD CONSTRAINT "EditorMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorContextRef" ADD CONSTRAINT "EditorContextRef_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EditorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorContextRef" ADD CONSTRAINT "EditorContextRef_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorContextRef" ADD CONSTRAINT "EditorContextRef_departmentEventId_fkey" FOREIGN KEY ("departmentEventId") REFERENCES "AdminDepartmentEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EditorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EditorMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_departmentEventId_fkey" FOREIGN KEY ("departmentEventId") REFERENCES "AdminDepartmentEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStateTransition" ADD CONSTRAINT "JobStateTransition_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
