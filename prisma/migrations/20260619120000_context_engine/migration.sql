-- Public recommendation/context engine telemetry.

CREATE TABLE "UserArticleEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "articleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "visibleMs" INTEGER,
    "scrollDepth" DOUBLE PRECISION,
    "feedScope" TEXT,
    "feedPosition" INTEGER,
    "surface" TEXT,
    "source" TEXT,
    "sessionId" TEXT,
    "pageViewId" TEXT,
    "context" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserArticleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserArticleContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "impressionCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "dwellMs" INTEGER NOT NULL DEFAULT 0,
    "maxScrollDepth" DOUBLE PRECISION,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "disliked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sharedCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "aiActionCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),
    "lastEngagedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserArticleContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInterestProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicWeights" JSONB,
    "sourceWeights" JSONB,
    "tagWeights" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInterestProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserArticleEvent_userId_occurredAt_idx" ON "UserArticleEvent"("userId", "occurredAt");
CREATE INDEX "UserArticleEvent_anonymousId_occurredAt_idx" ON "UserArticleEvent"("anonymousId", "occurredAt");
CREATE INDEX "UserArticleEvent_articleId_type_occurredAt_idx" ON "UserArticleEvent"("articleId", "type", "occurredAt");
CREATE INDEX "UserArticleEvent_type_occurredAt_idx" ON "UserArticleEvent"("type", "occurredAt");
CREATE INDEX "UserArticleEvent_sessionId_idx" ON "UserArticleEvent"("sessionId");
CREATE INDEX "UserArticleEvent_feedScope_occurredAt_idx" ON "UserArticleEvent"("feedScope", "occurredAt");
CREATE INDEX "UserArticleEvent_createdAt_idx" ON "UserArticleEvent"("createdAt");

CREATE UNIQUE INDEX "UserArticleContext_userId_articleId_key" ON "UserArticleContext"("userId", "articleId");
CREATE INDEX "UserArticleContext_userId_score_idx" ON "UserArticleContext"("userId", "score");
CREATE INDEX "UserArticleContext_userId_updatedAt_idx" ON "UserArticleContext"("userId", "updatedAt");
CREATE INDEX "UserArticleContext_articleId_idx" ON "UserArticleContext"("articleId");

CREATE UNIQUE INDEX "UserInterestProfile_userId_key" ON "UserInterestProfile"("userId");

ALTER TABLE "UserArticleEvent" ADD CONSTRAINT "UserArticleEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserArticleContext" ADD CONSTRAINT "UserArticleContext_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
