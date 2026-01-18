
import { PrismaClient } from '../generated/prisma/client';

try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    const word = process.argv[2];
    if (!word) {
        console.log('Please provide a word');
        return;
    }
    const data = await prisma.vocab.findUnique({
        where: { word },
    });
    console.log(JSON.stringify(data, null, 2));
}

main().finally(() => prisma.$disconnect());
