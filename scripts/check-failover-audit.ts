import 'dotenv/config';
import { db } from '@/lib/db';

async function main() {
    console.log('=== Failover 审计记录 (最新 5 条) ===');
    console.log(`查询时间: ${new Date().toLocaleTimeString('zh-CN')}\n`);

    const records = await db.drillAudit.findMany({
        where: { contextMode: 'LLM:FAILOVER' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    if (records.length === 0) {
        console.log('❌ 无 Failover 记录！说明 OpenRouter 从未被尝试或从未失败。');
    } else {
        console.log(`✅ 找到 ${records.length} 条记录：`);
        records.forEach((r, i) => {
            console.log(`\n--- #${i + 1} ---`);
            console.log(`时间: ${r.createdAt}`);
            const payload = r.payload as any;
            console.log(`Provider: ${payload?.decision?.failedProvider} → ${payload?.decision?.fallbackProvider}`);
            console.log(`Error: ${payload?.decision?.errorMessage}`);
            if (payload?.decision?.errorDetails) {
                console.log(`\n🔍 ErrorDetails (新增字段):`);
                console.log(JSON.stringify(payload.decision.errorDetails, null, 2));
            }
        });
    }

    await db.$disconnect();
}

main().catch(console.error);

