import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Adding HNSW index to Vocab.embedding...');
    try {
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Vocab_embedding_hnsw_idx" 
            ON "Vocab" USING hnsw (embedding vector_cosine_ops);
        `);
        console.log('Index created successfully.');
    } catch (e) {
        console.error('Failed to create index:', e);
    }
}

main().finally(() => prisma.$disconnect());
