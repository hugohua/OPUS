import 'dotenv/config';
import { AIService } from '@/lib/ai/core';
import { logger } from '@/lib/logger';

async function main() {
    console.log('--- Checking Env ---');
    console.log('AI_FAST_ORDER:', process.env.AI_FAST_ORDER);
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Unset');
    console.log('ETL_API_KEY:', process.env.ETL_API_KEY ? 'Set' : 'Unset');
    console.log('ETL_BASE_URL:', process.env.ETL_BASE_URL);

    console.log('\n--- Testing AI Service (Fast Mode) ---');
    try {
        const start = Date.now();
        const { text, provider } = await AIService.generateText({
            mode: 'fast',
            prompt: 'Say "Hello" and identify yourself.',
            temperature: 0.7
        });
        const duration = Date.now() - start;

        console.log(`\n✅ Success!`);
        console.log(`Provider: ${provider}`);
        console.log(`Time: ${duration}ms`);
        console.log(`Response: ${text}`);

        if (provider !== 'openrouter') {
            console.log('\n⚠️ WARNING: Provider is NOT openrouter. Failover likely occurred.');
        }

    } catch (error) {
        console.error('\n❌ Failed:', error);
    }
}

main().catch(console.error);
