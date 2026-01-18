
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching 10 vocab items...');
    const items = await prisma.vocab.findMany({
        take: 10,
    });

    const outputPath = path.join(process.cwd(), 'vocab_sample.json');
    fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));

    console.log(`✅ Exported ${items.length} items to ${outputPath}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
