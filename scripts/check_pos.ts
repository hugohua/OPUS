
try {
    process.loadEnvFile();
} catch (e) { }

import { prisma } from '../lib/prisma';

async function main() {
    const distinctPos = await prisma.vocab.groupBy({
        by: ['partOfSpeech'],
        _count: {
            partOfSpeech: true,
        },
        orderBy: {
            _count: {
                partOfSpeech: 'desc',
            },
        },
    });

    console.log('Distinct Part Of Speech values:');
    console.log(distinctPos);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
