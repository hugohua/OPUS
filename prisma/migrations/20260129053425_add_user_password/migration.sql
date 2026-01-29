/*
  Warnings:

  - A unique constraint covering the columns `[userId,vocabId,track]` on the table `UserProgress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "UserProgress_userId_vocabId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "invitedByCode" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "settings" JSONB DEFAULT '{}',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN     "masteryScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "track" TEXT NOT NULL DEFAULT 'VISUAL';

-- CreateTable
CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationCode_code_key" ON "InvitationCode"("code");

-- CreateIndex
CREATE INDEX "DrillCache_userId_mode_isConsumed_idx" ON "DrillCache"("userId", "mode", "isConsumed");

-- CreateIndex
CREATE INDEX "UserProgress_userId_track_next_review_at_idx" ON "UserProgress"("userId", "track", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_vocabId_track_key" ON "UserProgress"("userId", "vocabId", "track");

-- AddForeignKey
ALTER TABLE "DrillCache" ADD CONSTRAINT "DrillCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
