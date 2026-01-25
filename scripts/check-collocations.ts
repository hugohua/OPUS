
/**
 * Check Collocations Data Structure
 * Usage: npx tsx scripts/check-collocations.ts
 */
import { PrismaClient, Prisma } from '@/generated/prisma/client';


const prisma = new PrismaClient();

async function main() {
    const vocabs = await prisma.vocab.findMany({
        where: {
            collocations: {
                not: Prisma.DbNull,
            },
        },
        take: 5,
        select: {
            word: true,
            collocations: true,
        },
    });

    console.log('Found', vocabs.length, 'vocabs with collocations.');
    for (const v of vocabs) {
        console.log(`Word: ${v.word}`);
        console.log(JSON.stringify(v.collocations, null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
