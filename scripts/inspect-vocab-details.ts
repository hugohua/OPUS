
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const vocabs = await prisma.vocab.findMany({ where: { word: { in: ['time', 'year'] } } });
    console.log(vocabs);
}

main().finally(() => prisma.$disconnect());
