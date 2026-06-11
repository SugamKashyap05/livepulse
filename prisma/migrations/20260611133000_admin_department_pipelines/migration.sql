-- AlterTable
ALTER TABLE "AdminNotification"
ADD COLUMN     "department" TEXT,
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "departmentEventId" TEXT;

-- CreateTable
CREATE TABLE "AdminDepartmentEvent" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "needsEditorReview" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDepartmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_department_status_createdAt_idx" ON "AdminNotification"("department", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_departmentEventId_idx" ON "AdminNotification"("departmentEventId");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_department_createdAt_idx" ON "AdminDepartmentEvent"("department", "createdAt");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_department_status_createdAt_idx" ON "AdminDepartmentEvent"("department", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_needsEditorReview_status_createdAt_idx" ON "AdminDepartmentEvent"("needsEditorReview", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_jobId_idx" ON "AdminDepartmentEvent"("jobId");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_type_idx" ON "AdminDepartmentEvent"("type");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_severity_idx" ON "AdminDepartmentEvent"("severity");

-- CreateIndex
CREATE INDEX "AdminDepartmentEvent_createdAt_idx" ON "AdminDepartmentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminDepartmentEvent" ADD CONSTRAINT "AdminDepartmentEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdminAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_departmentEventId_fkey" FOREIGN KEY ("departmentEventId") REFERENCES "AdminDepartmentEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
