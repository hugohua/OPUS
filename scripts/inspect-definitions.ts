/**
 * Inspect Definitions Field
 * 
 * 功能：
 *   抽样检查 definitions 字段的实际结构，判断是格式问题还是缺失问题。
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Inspecting definitions field structure...\n');

    // Sample 20 words with definition_cn but check their definitions
    const samples = await prisma.vocab.findMany({
        where: {
            definition_cn: { not: null },
        },
        select: {
            word: true,
            definition_cn: true,
            definitions: true,
        },
        take: 20,
        orderBy: { word: 'asc' }
    });

    let nullCount = 0;
    let arrayCount = 0;
    let objectMissingGeneralCn = 0;
    let validCount = 0;
    let otherCount = 0;

    console.log('=== Sample Analysis ===');
    samples.forEach(s => {
        const defs = s.definitions;

        if (defs === null || defs === undefined) {
            nullCount++;
            console.log(`[${s.word.padEnd(15)}] NULL`);
        } else if (Array.isArray(defs)) {
            arrayCount++;
            console.log(`[${s.word.padEnd(15)}] ARRAY: ${JSON.stringify(defs).substring(0, 60)}...`);
        } else if (typeof defs === 'object') {
            const obj = defs as any;
            if (obj.general_cn && typeof obj.general_cn === 'string') {
                validCount++;
                console.log(`[${s.word.padEnd(15)}] VALID: { general_cn: "${obj.general_cn.substring(0, 20)}..." }`);
            } else {
                objectMissingGeneralCn++;
                console.log(`[${s.word.padEnd(15)}] OBJ_NO_GENERAL: ${JSON.stringify(defs).substring(0, 60)}...`);
            }
        } else {
            otherCount++;
            console.log(`[${s.word.padEnd(15)}] OTHER: ${typeof defs}`);
        }
    });

    console.log('\n=== Summary ===');
    console.log(`NULL definitions:        ${nullCount}`);
    console.log(`Array (old format):      ${arrayCount}`);
    console.log(`Object missing general:  ${objectMissingGeneralCn}`);
    console.log(`Valid:                   ${validCount}`);
    console.log(`Other:                   ${otherCount}`);

    // Global count
    console.log('\n=== Global Counts ===');

    // Count totally null definitions
    const totalNullDefs = await prisma.vocab.count({
        where: {
            definition_cn: { not: null },
            definitions: { equals: Prisma.DbNull }
        }
    });
    console.log(`Words with definition_cn but NULL definitions: ${totalNullDefs}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
