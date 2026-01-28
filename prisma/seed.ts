try { process.loadEnvFile(); } catch { }

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Create Genesis Invitation Code (Unlimited uses for internal testing)
    const genesisCode = await prisma.invitationCode.upsert({
        where: { code: 'OPUS_GENESIS_KEY' },
        update: {},
        create: {
            code: 'OPUS_GENESIS_KEY',
            maxUses: 9999,
            isActive: true,
        },
    })
    console.log(`🔑 Created Genesis Code: ${genesisCode.code}`)

    // 2. Create Initial Admin User (Hugo)
    const userEmail = '13964332@qq.com'
    const userName = 'Hugo'
    const rawPassword = '123456'
    const hashedPassword = await bcrypt.hash(rawPassword, 10)

    const adminUser = await prisma.user.upsert({
        where: { email: userEmail },
        update: {
            password: hashedPassword, // Reset password on seed if user exists
            name: userName
        },
        create: {
            email: userEmail,
            name: userName,
            password: hashedPassword, // 123456
            invitedByCode: genesisCode.code,
            settings: {},
        },
    })

    console.log(`👤 Created Admin User: ${adminUser.name} (${adminUser.email})`)



    console.log('✅ Seed finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
