import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Inspecting Vocab collocations...');

    const vocabs = await prisma.vocab.findMany({
        where: {
            collocations: { not: { equals: null } }
        },
        take: 3,
        select: {
            word: true,
            collocations: true
        }
    });

    if (vocabs.length === 0) {
        console.log('⚠️ No vocabs found with collocations.');
        // Check total vocabs
        const count = await prisma.vocab.count();
        console.log(`Total vocabs: ${count}`);
        return;
    }

    vocabs.forEach((v: any) => {
        console.log(`\nWord: ${v.word}`);
        console.log('Collocations:', JSON.stringify(v.collocations, null, 2));
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
