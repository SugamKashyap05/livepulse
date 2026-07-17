CREATE TABLE "AdminConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminConfig_key_key" ON "AdminConfig"("key");

INSERT INTO "AdminConfig" ("id", "key", "value", "updatedAt")
VALUES (gen_random_uuid()::text, 'RAG_CONFIDENCE_THRESHOLD', '0.45', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
