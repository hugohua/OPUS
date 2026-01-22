try { process.loadEnvFile(); } catch { }
import { PrismaClient } from '../generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Testing POS upsert...");
    try {
        const res = await prisma.vocab.upsert({
            where: { word: 'test-pos-diagnostic' },
            update: { partOfSpeech: 'n.' },
            create: {
                word: 'test-pos-diagnostic',
                partOfSpeech: 'n.',
                source: 'diagnostic',
                definition_jp: 'test'
            }
        });
        console.log("Success:", res);

        // Clean up
        await prisma.vocab.delete({ where: { word: 'test-pos-diagnostic' } });
    } catch (e) {
        console.error("Failure:", e);
    }
}

main();
