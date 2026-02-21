import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const p = new PrismaClient();

async function main() {
    const total = await p.questionSeed.count();
    const recent = await p.questionSeed.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`\nTotal QuestionSeed: ${total}\n`);
    for (const q of recent) {
        console.log('=====');
        console.log('originalNumber:', q.originalNumber);
        console.log('sentence:', q.sentence.substring(0, 60));
        console.log('targetAnswer:', q.targetAnswer);
        console.log('questionType:', q.questionType);
        console.log('posTested:', q.posTested);
        console.log('scenario:', q.scenario);
        console.log('anchorText:', q.anchorText);
        console.log('anchorVocabId:', q.anchorVocabId);
        console.log('source:', q.source);
        console.log('rationale chars:', q.rationale?.length ?? 0);
        const opts = q.options as any[];
        console.log('options count:', Array.isArray(opts) ? opts.length : 'invalid');
        console.log('correct option:', Array.isArray(opts) ? opts.find((o: any) => o.isCorrect)?.text : 'N/A');
    }
}

main().catch(console.error).finally(() => p.$disconnect());
