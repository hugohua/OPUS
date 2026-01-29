
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.vocab.updateMany({
        where: { word: { in: ['time', 'year'] } },
        data: { partOfSpeech: 'n' }
    });
    console.log('Fixed POS for time/year');
}

main().finally(() => prisma.$disconnect());
