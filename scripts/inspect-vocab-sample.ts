
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const vocabs = await prisma.vocab.findMany({ take: 5 });
    console.log(vocabs.map(v => ({ id: v.id, word: v.word, pos: v.partOfSpeech })));
}

main().finally(() => prisma.$disconnect());
