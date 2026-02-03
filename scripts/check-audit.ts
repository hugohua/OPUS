import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const stats = await prisma.drillAudit.groupBy({
        by: ['contextMode'],
        _count: true
    });

    console.log('📊 DrillAudit 审计记录统计:');
    console.log(JSON.stringify(stats, null, 2));

    // 获取最近的审计记录
    const recent = await prisma.drillAudit.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            contextMode: true,
            targetWord: true,
            status: true,
            auditTags: true,
            createdAt: true
        }
    });

    console.log('\n📜 最近 5 条审计记录:');
    console.log(JSON.stringify(recent, null, 2));
}

main().finally(() => prisma.$disconnect());
