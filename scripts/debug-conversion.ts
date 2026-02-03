
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 1. OMPS Selected Count
    const ompsLogs = await prisma.drillAudit.findMany({
        where: {
            contextMode: 'OMPS:SELECTION',
            createdAt: { gt: oneHourAgo }
        },
        select: { payload: true }
    });

    let totalSelected = 0;
    ompsLogs.forEach(log => {
        const p = log.payload as any;
        totalSelected += (p.decision?.totalSelected || 0);
    });

    // 2. LLM Generated Count
    const llmCount = await prisma.drillAudit.count({
        where: {
            contextMode: { startsWith: 'L' }, // L0:*, L1:*
            createdAt: { gt: oneHourAgo }
        }
    });

    console.log(`\n📊 Conversion Report (Last 1 Hour):`);
    console.log(`OMPS Selected Words: ${totalSelected}`);
    console.log(`LLM Generated Drills: ${llmCount}`);

    if (totalSelected > 0) {
        const rate = (llmCount / totalSelected) * 100;
        console.log(`Conversion Rate: ${rate.toFixed(1)}%`);

        if (rate < 80) {
            console.log(`\n⚠️ CRITICAL: Low conversion rate! Worker might be stuck or failing silently.`);
        }
    } else {
        console.log(`No activity in last hour.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
