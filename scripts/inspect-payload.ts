import { PrismaClient } from '@prisma/client';
import { VectorizationService } from '../lib/ai/vectorization';
const prisma = new PrismaClient();
const service = new VectorizationService();
async function main() {
    const v = await prisma.vocab.findFirst({ where: { word: 'bound' } });
    if (v) {
        console.log(service.constructEmbeddingPayload(v as any));
    } else {
        console.log('Word not found');
    }
}
main().finally(() => prisma.$disconnect());
