
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.drillAudit.findMany({
        where: {
            contextMode: 'OMPS:SELECTION'
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`\n🔍 Recent OMPS Decisions (${logs.length}):`);

    logs.forEach(log => {
        const payload = log.payload as any;
        const decision = payload.decision || {};
        const context = payload.context || {};

        console.log(`\n[${log.createdAt.toLocaleTimeString()}] Target: ${log.targetWord}`);
        console.log(`   Mode: ${context.mode} | Track: ${context.track}`);
        console.log(`   Selected: ${decision.totalSelected} (Hot: ${decision.hotCount}, Review: ${decision.reviewCount}, New: ${decision.newCount})`);

        if (decision.totalSelected < 5) {
            console.log(`   ⚠️ LOW SELECTION!`);
        }

        if (log.auditTags && log.auditTags.includes('selection_shortage')) {
            console.log(`   🏷️ TAG: selection_shortage`);
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
