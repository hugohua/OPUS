import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const key = 'AUTH_SECRET';

try {
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    if (content.includes(key + '=')) {
        console.log(`✅ ${key} already exists in .env`);
    } else {
        const secret = crypto.randomBytes(32).toString('hex');
        fs.appendFileSync(envPath, `\n# NextAuth Secret\n${key}="${secret}"\n`);
        console.log(`✅ Added ${key} to .env`);
    }
} catch (e) {
    console.error('❌ Failed to update .env:', e);
}
