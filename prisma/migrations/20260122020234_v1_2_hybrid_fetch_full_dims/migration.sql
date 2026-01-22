-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'MASTERED');

-- CreateEnum
CREATE TYPE "VocabRole" AS ENUM ('TARGET', 'CONTEXT');

-- CreateEnum
CREATE TYPE "VocabPriority" AS ENUM ('CORE', 'SUPPORT', 'NOISE');

-- CreateTable
CREATE TABLE "Vocab" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "phoneticUk" TEXT,
    "phoneticUs" TEXT,
    "audioUk" TEXT,
    "partOfSpeech" TEXT,
    "commonExample" TEXT,
    "definition_cn" TEXT,
    "definitions" JSONB,
    "is_toeic_core" BOOLEAN NOT NULL DEFAULT false,
    "scenarios" TEXT[],
    "collocations" JSONB,
    "priority" "VocabPriority",
    "word_family" JSONB,
    "confusing_words" TEXT[],
    "synonyms" TEXT[],
    "tags" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'oxford_5000',
    "source_meta" JSONB,
    "cefrLevel" TEXT,
    "abceed_level" INTEGER,
    "abceed_rank" INTEGER,
    "definition_jp" TEXT,
    "learningPriority" INTEGER NOT NULL DEFAULT 0,
    "frequency_score" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),

    CONSTRAINT "Vocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "status" "LearningStatus" NOT NULL DEFAULT 'NEW',
    "interval" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteryMatrix" JSONB NOT NULL DEFAULT '{}',
    "lastContextSentence" TEXT,
    "dim_v_score" INTEGER NOT NULL DEFAULT 0,
    "dim_c_score" INTEGER NOT NULL DEFAULT 0,
    "dim_m_score" INTEGER NOT NULL DEFAULT 0,
    "dim_x_score" INTEGER NOT NULL DEFAULT 0,
    "dim_a_score" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3),

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "summaryZh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleVocab" (
    "articleId" TEXT NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "role" "VocabRole" NOT NULL,

    CONSTRAINT "ArticleVocab_pkey" PRIMARY KEY ("articleId","vocabId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vocab_word_key" ON "Vocab"("word");

-- CreateIndex
CREATE INDEX "Vocab_learningPriority_idx" ON "Vocab"("learningPriority");

-- CreateIndex
CREATE INDEX "Vocab_scenarios_idx" ON "Vocab"("scenarios");

-- CreateIndex
CREATE INDEX "Vocab_frequency_score_idx" ON "Vocab"("frequency_score");

-- CreateIndex
CREATE INDEX "UserProgress_userId_dueDate_idx" ON "UserProgress"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "UserProgress_userId_dim_v_score_idx" ON "UserProgress"("userId", "dim_v_score");

-- CreateIndex
CREATE INDEX "UserProgress_userId_next_review_at_idx" ON "UserProgress"("userId", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_vocabId_key" ON "UserProgress"("userId", "vocabId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "Vocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVocab" ADD CONSTRAINT "ArticleVocab_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVocab" ADD CONSTRAINT "ArticleVocab_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "Vocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
