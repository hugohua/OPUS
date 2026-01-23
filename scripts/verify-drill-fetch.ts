
import { db } from '@/lib/db';
import { getNextDrillBatch } from '@/actions/get-next-drill';

async function main() {
    try {
        // 1. Load Env (Next.js loads .env automatically, but for script we might need manual load or rely on npx tsx loading if configured, 
        // but explicit load is safer if relying on Node native env loading for .env file)
        // However, prisma client handles its own env loading usually.
        // The AI client might need OPENAI_API_KEY.
        // Let's assume process.loadEnvFile() is available in Node 20+ or we rely on preloading.
        try { process.loadEnvFile(); } catch { }

        console.log('🔍 Verifying Drill Fetch...');

        // 2. Get User
        const user = await db.user.findFirst({
            where: { email: '13964332@qq.com' }
        });

        if (!user) {
            console.error('❌ User not found. Please run seed first.');
            process.exit(1);
        }
        console.log(`👤 User found: ${user.name} (${user.id})`);

        // 3. Call getNextDrillBatch
        console.log('🚀 Calling getNextDrillBatch...');
        const result = await getNextDrillBatch({
            userId: user.id,
            mode: 'SYNTAX',
            limit: 5, // Small batch for test
            excludeVocabIds: []
        });

        // 4. Check Result
        if (result.status === 'success') {
            console.log('✅ Success! Drill batch generated.');
            console.log(`📦 Batch Size: ${result.data?.length}`);
            if (result.data && result.data.length > 0) {
                console.log('📝 First Drill Segment:', JSON.stringify(result.data[0].segments[0], null, 2));
            }
        } else {
            console.error('❌ Failed:', result.message);
            if (result.message === 'No vocab candidates found.') {
                console.error('⚠️  Reason: Database might lack sufficient vocab or spaced repetition criteria not met.');
            }
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
        process.exit(1);
    }
}

main();
