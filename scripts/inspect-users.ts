try { process.loadEnvFile(); } catch { }
import { db } from '@/lib/db';

async function main() {
    console.log('=== User Inspection ===');
    const users = await db.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
        }
    });

    if (users.length === 0) {
        console.log('No users found in database.');
    } else {
        console.table(users);
    }
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
