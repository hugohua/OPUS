
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking DrillAudit for NUANCE inventory events...');

    // 1. Check for INVENTORY_FULL events for NUANCE
    // contextMode should be INVENTORY:FULL
    // targetWord should be INVENTORY:NUANCE
    const fullEvents = await prisma.drillAudit.findMany({
        where: {
            contextMode: 'INVENTORY:FULL',
            targetWord: 'INVENTORY:NUANCE'
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log(`\nFound ${fullEvents.length} INVENTORY_FULL events:`);
    fullEvents.forEach(e => {
        console.log(`[${e.createdAt.toISOString()}] Payload: ${JSON.stringify(e.payload)}`);
    });

    // 2. Check for INVENTORY_ADD events for NUANCE
    const addEvents = await prisma.drillAudit.findMany({
        where: {
            contextMode: 'INVENTORY:ADD',
            targetWord: 'INVENTORY:NUANCE'
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log(`\nFound ${addEvents.length} INVENTORY_ADD events:`);
    addEvents.forEach(e => {
        console.log(`[${e.createdAt.toISOString()}] Payload: ${JSON.stringify(e.payload)}`);
    });

    // 3. Count total events
    const count = await prisma.drillAudit.count({
        where: { targetWord: 'INVENTORY:NUANCE' }
    });
    console.log(`\nTotal INVENTORY:NUANCE events: ${count}`);

}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
