try { process.loadEnvFile(); } catch { }

import { PrismaClient } from '../generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔌 Connecting to DB to enable extensions...')
    try {
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')
        console.log('✅ Extension "vector" enabled.')
    } catch (e) {
        console.error('❌ Failed to enable extension:', e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
