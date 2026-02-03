
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const pivotCount = await prisma.drillAudit.count({
        where: {
            auditTags: {
                has: 'pivot_fallback'
            }
        }
    });

    console.log(`\n🔍 Pivot Fallback Count: ${pivotCount}`);

    if (pivotCount > 0) {
        const pivots = await prisma.drillAudit.findMany({
            where: {
                auditTags: {
                    has: 'pivot_fallback'
                }
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        console.log('\nRecent Pivots:');
        pivots.forEach(p => {
            console.log(`[${p.createdAt.toISOString()}] ${p.targetWord} (${p.contextMode})`);
        });
    } else {
        console.log('✅ No pivot fallbacks detected in audit logs.');

        // 检查 Worker 生成总数
        const total = await prisma.drillAudit.count({
            where: {
                contextMode: { startsWith: 'L' }
            }
        });
        console.log(`Total LLM Generations logged: ${total}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
