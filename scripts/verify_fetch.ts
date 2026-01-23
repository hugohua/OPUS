
try { process.loadEnvFile(); } catch (e) { }
import { prisma } from '../lib/prisma';

async function verifyFetch() {
    const userId = 'cl00000000000000000000000';
    const posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞'];

    const count = await prisma.vocab.count({
        where: {
            progress: { none: { userId } },
            partOfSpeech: { in: posFilter },
            OR: [
                { abceed_level: { lte: 1 } },
                { is_toeic_core: true }
            ]
        }
    });

    console.log(`Matching candidates count: ${count}`);

    if (count > 0) {
        const sample = await prisma.vocab.findMany({
            where: {
                progress: { none: { userId } },
                partOfSpeech: { in: posFilter },
                OR: [
                    { abceed_level: { lte: 1 } },
                    { is_toeic_core: true }
                ]
            },
            take: 5
        });
        console.log('Sample candidates:', sample.map(s => `${s.word} (${s.partOfSpeech})`));
    }
}

verifyFetch().finally(() => prisma.$disconnect());
