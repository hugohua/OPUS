import fs from 'fs';
import path from 'path';
import { generateObject } from 'ai';
import { PrismaClient } from '@prisma/client';
import { getAIModel } from '../../lib/ai/client';
import { PART6_SEED_SYSTEM_PROMPT, Part6SeedSchema } from '../../lib/generators/etl/part6-seed-prompt';
import { createLogger } from '../../lib/logger';
import 'dotenv/config';

const log = createLogger('seed-part6-image');
const prisma = new PrismaClient();

async function processImage(imagePath: string) {
    log.info(`Processing image: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    const { model, modelName } = getAIModel('etl');

    try {
        const { object } = await generateObject({
            model,
            schema: Part6SeedSchema,
            messages: [
                { role: 'system', content: PART6_SEED_SYSTEM_PROMPT },
                {
                    role: 'user', content: [
                        { type: 'text', text: 'Extract TOEIC Part 6 questions from this image and format as JSON. Make sure you transcribe the passage text accurately and insert the blanks.' },
                        { type: 'image', image: imageBuffer }
                    ]
                }
            ],
            temperature: 0.1,
        });

        log.info(`Extracted ${object.passages.length} passages from ${path.basename(imagePath)}`);

        let successCount = 0;
        const sourceName = `toeic_part6_img_${path.basename(imagePath)}`;

        await prisma.$transaction(async (tx) => {
            for (const passage of object.passages) {
                let shouldSkipPassage = false;
                for (const q of passage.questions) {
                    let existingCount = 0;
                    if (q.sentence === "") {
                        // SENTENCE_INSERTION fallback
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

                const dbPassage = await tx.passage.create({
                    data: {
                        part: 6,
                        content: passage.content,
                        scenario: passage.questions[0]?.scenario || null
                    }
                });

                let orderIndex = 1;
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
                            options: q.options as any,
                            rationale: q.rationale,
                            anchorVocabId: anchorVocabId,
                            anchorText: q.anchorText,
                            questionType: q.questionType as any,
                            posTested: q.posTested,
                            part: 6,
                            scenario: q.scenario,
                            source: sourceName,
                            passageId: dbPassage.id,
                            passageOrder: orderIndex
                        }
                    });

                    orderIndex++;
                    successCount++;
                }
            }
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        log.info(`Successfully inserted ${successCount} questions for ${imagePath}`);
    } catch (err: any) {
        log.error(`Process failed for image ${imagePath}: ${err.message || err}`);
    }
}

async function main() {
    const dirPath = path.resolve(process.cwd(), 'books', 'part6');
    if (!fs.existsSync(dirPath)) {
        log.error(`Directory not found: ${dirPath}`);
        process.exit(1);
    }

    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
        .sort();

    log.info(`Found ${files.length} images to process.`);
    for (const file of files) {
        await processImage(path.join(dirPath, file));
    }

    log.info("Finished processing all images!");
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
