-- CreateTable
CREATE TABLE "DrillAudit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetWord" TEXT NOT NULL,
    "contextMode" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "auditScore" INTEGER,
    "auditReason" TEXT,
    "isRedundant" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,

    CONSTRAINT "DrillAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TTSCache" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'Cherry',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cacheType" TEXT NOT NULL DEFAULT 'temporary',
    "filePath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TTSCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrillAudit_status_idx" ON "DrillAudit"("status");

-- CreateIndex
CREATE INDEX "DrillAudit_targetWord_idx" ON "DrillAudit"("targetWord");

-- CreateIndex
CREATE INDEX "DrillAudit_createdAt_idx" ON "DrillAudit"("createdAt");

-- CreateIndex
CREATE INDEX "TTSCache_lastUsedAt_idx" ON "TTSCache"("lastUsedAt");

-- CreateIndex
CREATE INDEX "TTSCache_createdAt_idx" ON "TTSCache"("createdAt");

-- CreateIndex
CREATE INDEX "TTSCache_cacheType_idx" ON "TTSCache"("cacheType");
