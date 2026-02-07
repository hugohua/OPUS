
import { ProviderRegistry } from '../lib/ai/providers';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env' });

console.log('--- Env Vars ---');
console.log('AI_FAST_ORDER:', process.env.AI_FAST_ORDER);
console.log('AI_SMART_ORDER:', process.env.AI_SMART_ORDER);

console.log('\n--- Provider Registry ---');
const fastList = ProviderRegistry.getFailoverList('fast');
console.log('Fast List IDs:', fastList.map(p => p.id));
const smartList = ProviderRegistry.getFailoverList('smart');
console.log('\n--- Testing AIService Generation ---');
import { AIService } from '../lib/ai/core';

async function testGen() {
    try {
        console.log('Attempting generateText...');
        const result = await AIService.generateText({
            mode: 'fast',
            prompt: 'Hello, are you working?',
            temperature: 0.7
        });
        console.log('Result Provider:', result.provider);
        console.log('Result Text:', result.text);
    } catch (e) {
        console.error('Generation failed:', e);
    }
}

testGen();
