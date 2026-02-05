
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    console.log('Testing File Read...');
    const backupDir = path.join(process.cwd(), 'backups');
    // Hardcoded timestamp from user request/previous output
    const timestamp = '2026-02-05T01-05-58-211Z';
    const filePath = path.join(backupDir, `smartContent-${timestamp}.json`);

    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log(`SmartContent file size: ${content.length}`);
            const data = JSON.parse(content);
            console.log(`Parsed SmartContent: ${data.length} records`);
        } else {
            console.error('File not found:', filePath);
        }
    } catch (e) {
        console.error('Error parsing smartContent:', e);
    }

    console.log('Success');
}
main();
