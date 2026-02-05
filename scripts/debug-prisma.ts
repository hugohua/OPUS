
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Prisma Client Keys:');
    const keys = Object.keys(prisma);
    // Filter internal properties (start with _) if needed, or just show all
    const models = keys.filter(k => !k.startsWith('_') && !k.startsWith('$'));
    console.log(models);

    // Check specific casing for TTSCache
    console.log('Has ttsCache?', 'ttsCache' in prisma);
    console.log('Has TTSCache?', 'TTSCache' in prisma);
    console.log('Has tTSCache?', 'tTSCache' in prisma);

    await prisma.$disconnect();
}
main();
