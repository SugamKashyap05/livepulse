-- AlterTable
ALTER TABLE "FeedSource"
ADD COLUMN     "fetchIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorMessage" TEXT;

-- CreateIndex
CREATE INDEX "FeedSource_enabled_lastFetched_idx" ON "FeedSource"("enabled", "lastFetched");
