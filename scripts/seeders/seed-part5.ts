import { Prisma } from '@prisma/client';
import { runPdfSeeder } from './lib/pdf-seeder-core';
import { PART5_SEED_SYSTEM_PROMPT, QuestionSeedSchema } from '../../lib/generators/etl/part5-seed-prompt';

async function main() {
    await runPdfSeeder({
        systemPrompt: PART5_SEED_SYSTEM_PROMPT,
        schema: QuestionSeedSchema,
        heuristicFilter: (chunkText) => {
            return chunkText.includes('(A)') || /1[0-4]\d\./.test(chunkText);
        },
        mapper: async (parsedData: any, tx: Prisma.TransactionClient, sourceName: string) => {
            let successCount = 0;
            const data = parsedData as { questions: any[] };

            for (const q of data.questions) {
                let anchorVocabId: number | null = null;
                if (q.anchorText) {
                    const vocab = await tx.vocab.findFirst({
                        where: { word: { equals: q.anchorText, mode: 'insensitive' } }
                    });
                    if (vocab) anchorVocabId = vocab.id;
                }

                const existingCount = await tx.questionSeed.count({
                    where: { sentence: q.sentence }
                });

                if (existingCount === 0) {
                    await tx.questionSeed.create({
                        data: {
                            originalNumber: q.originalNumber,
                            sentence: q.sentence,
                            targetAnswer: q.targetAnswer,
                            options: q.options as Prisma.InputJsonValue,
                            rationale: q.rationale,
                            anchorVocabId: anchorVocabId,
                            anchorText: q.anchorText,
                            questionType: q.questionType as any,
                            posTested: q.posTested,
                            part: 5,
                            scenario: q.scenario,
                            source: sourceName
                        }
                    });
                    successCount++;
                }
            }
            return successCount;
        }
    });
}

main().catch(console.error);
