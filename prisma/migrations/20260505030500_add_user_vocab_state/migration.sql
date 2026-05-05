-- CreateEnum
CREATE TYPE "UserVocabStatus" AS ENUM ('ACTIVE', 'MASTERED');

-- CreateTable
CREATE TABLE "UserVocabState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "status" "UserVocabStatus" NOT NULL DEFAULT 'ACTIVE',
    "masteredAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVocabState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabState_userId_vocabId_key" ON "UserVocabState"("userId", "vocabId");

-- CreateIndex
CREATE INDEX "UserVocabState_userId_status_idx" ON "UserVocabState"("userId", "status");

-- CreateIndex
CREATE INDEX "UserVocabState_userId_isFavorite_idx" ON "UserVocabState"("userId", "isFavorite");

-- AddForeignKey
ALTER TABLE "UserVocabState" ADD CONSTRAINT "UserVocabState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabState" ADD CONSTRAINT "UserVocabState_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "Vocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
