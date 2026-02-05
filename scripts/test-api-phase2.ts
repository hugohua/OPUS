
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testApi() {
    console.log('🧪 Starting Phase 2 API Verification (Dry Run)...\n');

    // Test 1: Weaver V2 (Unauthorized)
    try {
        console.log('Testing PST /api/weaver/v2/generate...');
        const res = await fetch(`${BASE_URL}/api/weaver/v2/generate`, {
            method: 'POST',
            body: JSON.stringify({ scenario: 'finance' }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[Weaver V2] Status: ${res.status} (Expected 401)`);

        if (res.status === 401) {
            console.log('✅ Auth Guard Working');
        } else if (res.status === 200) {
            console.log('⚠️ Endpoint Open (No Auth?)');
        } else {
            console.log(`❓ Unexpected Status: ${res.status}`);
            const text = await res.text();
            console.log('Response:', text.substring(0, 100));
        }
    } catch (e) {
        console.error('❌ Network Error (Weaver). Server might not be running.', e);
    }

    // Test 2: Magic Wand (Unauthorized)
    try {
        console.log('\nTesting GET /api/wand/word...');
        const res = await fetch(`${BASE_URL}/api/wand/word?word=strategy`, {
            method: 'GET'
        });
        console.log(`[Magic Wand] Status: ${res.status} (Expected 401)`);

        if (res.status === 401) {
            console.log('✅ Auth Guard Working');
        } else {
            console.log(`❓ Unexpected Status: ${res.status}`);
        }
    } catch (e) {
        console.error('❌ Network Error (Wand)', e);
    }
}

testApi();
