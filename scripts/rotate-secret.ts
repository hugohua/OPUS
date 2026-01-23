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

    const newSecret = crypto.randomBytes(32).toString('hex');
    const newLine = `${key}="${newSecret}"`;

    let newContent = '';
    if (content.includes(key + '=')) {
        // Replace existing
        const regex = new RegExp(`${key}=.*`, 'g');
        newContent = content.replace(regex, newLine);
        console.log(`✅ Rotated ${key}`);
    } else {
        // Append
        newContent = content + `\n${newLine}\n`;
        console.log(`✅ Added ${key}`);
    }

    fs.writeFileSync(envPath, newContent);

} catch (e) {
    console.error('❌ Failed to update .env:', e);
}
