
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking last 5 generated etymologies...");
    const results = await prisma.etymology.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
            vocab: {
                select: { word: true }
            }
        }
    });

    for (const res of results) {
        console.log(`\n[${res.vocab.word}] Mode: ${res.mode}`);
        console.log(`Logic: ${res.memory_hook}`);
        console.log(`Data: ${JSON.stringify(res.data)}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
