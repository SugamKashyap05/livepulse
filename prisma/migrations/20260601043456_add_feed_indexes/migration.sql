-- CreateIndex
CREATE INDEX "NewsArticle_published_pubDate_idx" ON "NewsArticle"("published", "pubDate" DESC);

-- CreateIndex
CREATE INDEX "NewsArticle_topic_published_pubDate_idx" ON "NewsArticle"("topic", "published", "pubDate" DESC);

-- CreateIndex
CREATE INDEX "NewsArticle_published_fetchedAt_idx" ON "NewsArticle"("published", "fetchedAt" DESC);
