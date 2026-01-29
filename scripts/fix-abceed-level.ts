
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.vocab.updateMany({
        where: { word: { in: ['time', 'year'] } },
        data: { abceed_level: 1 }
    });
    console.log('Fixed abceed_level');
}

main().finally(() => prisma.$disconnect());
