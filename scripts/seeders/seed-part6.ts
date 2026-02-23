import { Prisma } from '@prisma/client';
import { runPdfSeeder } from './lib/pdf-seeder-core';
import { PART6_SEED_SYSTEM_PROMPT, Part6SeedSchema } from '../../lib/generators/etl/part6-seed-prompt';
import { createLogger } from '../../lib/logger';

const log = createLogger('seed-part6');
async function main() {
    await runPdfSeeder({
        systemPrompt: PART6_SEED_SYSTEM_PROMPT,
        schema: Part6SeedSchema,
        heuristicFilter: (chunkText) => {
            // Part 6 always has options starting with (A) and multiple questions
            return chunkText.includes('(A)') || /1[3-4]\d\./.test(chunkText);
        },
        mapper: async (parsedData: any, tx: Prisma.TransactionClient, sourceName: string) => {
            let successCount = 0;
            const data = parsedData as { passages: any[] };

            log.info(`[Mapper] Data contains ${data.passages.length} passages for ${sourceName}`);
            for (const passage of data.passages) {
                // To maintain transaction atomicity, we check if ANY question from this passage exists
                // If yes, we skip the whole passage to avoid partial duplicates
                let shouldSkipPassage = false;
                for (const q of passage.questions) {
                    let existingCount = 0;
                    if (q.sentence === "") {
                        // For SENTENCE_INSERTION, sentence is empty. We rely on passageContext + targetAnswer logic.
                        // Wait, since passageContext might have OCR errors or mapping placeholders, we can just use 
                        // targetAnswer + originalNumber + part = 6 to avoid empty sentence collision.
                        existingCount = await tx.questionSeed.count({
                            where: { targetAnswer: q.targetAnswer, originalNumber: q.originalNumber, part: 6 }
                        });
                    } else {
                        existingCount = await tx.questionSeed.count({
                            where: { sentence: q.sentence, targetAnswer: q.targetAnswer }
                        });
                    }
                    if (existingCount > 0) {
                        shouldSkipPassage = true;
                        log.warn(`[Mapper] Skipping passage because question '${q.originalNumber}' (${q.targetAnswer}) already exists.`);
                        break;
                    }
                }

                if (shouldSkipPassage) {
                    continue;
                }

                for (const q of passage.questions) {
                    let anchorVocabId: number | null = null;
                    if (q.anchorText) {
                        const vocab = await tx.vocab.findFirst({
                            where: { word: { equals: q.anchorText, mode: 'insensitive' } }
                        });
                        if (vocab) anchorVocabId = vocab.id;
                    }

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
                            part: 6,
                            scenario: q.scenario,
                            source: sourceName,
                            passageContext: passage.passageContext
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
