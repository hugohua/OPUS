import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // Check vector dimension using pgvector function if available, or just check string length for a rough heuristic
    // Here we just print the vector raw string to see if it looks like a 1536 dim vector
    const result = await prisma.$queryRaw<any[]>`
        SELECT word, vector_dims(embedding) as dims FROM "Vocab" 
        WHERE embedding IS NOT NULL 
        LIMIT 1
    `;
    console.log(result);
}
main().finally(() => prisma.$disconnect());
