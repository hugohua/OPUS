try { process.loadEnvFile(); } catch { }

import { PrismaClient } from '../generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
    const code = process.argv[2]
    const uses = parseInt(process.argv[3] || '1', 10)

    if (!code) {
        console.error('Usage: tsx scripts/generate-invite.ts <CODE> [MAX_USES]')
        process.exit(1)
    }

    const result = await prisma.invitationCode.create({
        data: {
            code: code.toUpperCase(),
            maxUses: uses,
        },
    })

    console.log(`✅ Created Invite Code: ${result.code} (Uses: ${result.maxUses})`)
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
