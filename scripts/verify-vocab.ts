
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    const words = ['accord', 'apron', 'Steve'];

    for (const w of words) {
        const v = await prisma.vocab.findUnique({ where: { word: w } });
        console.log(`\n🔎 Checking "${w}":`);
        if (v) {
            console.log(`   - ID: ${v.id}`);
            console.log(`   - Source: ${v.source}`);
            console.log(`   - Abceed Level: ${v.abceed_level}`);
            // console.log(`   - Collocations:`, JSON.stringify(v.collocations, null, 2));
            console.log(`   - Tags: ${v.tags.join(', ')}`);

            // Print header of collocations to verify structure
            if (Array.isArray(v.collocations) && v.collocations.length > 0) {
                console.log(`   - Top Collocation:`, JSON.stringify(v.collocations[0]));
            }
        } else {
            console.log(`   ❌ Not Found!`);
        }
    }
}

main()
    .finally(() => prisma.$disconnect());
