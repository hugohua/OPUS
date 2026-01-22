import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth-mock');

const MOCK_USER_EMAIL = 'admin@opus.local';

/**
 * Get or Create Mock User
 * Used for Level 0 MVP where no real Auth is implemented yet.
 */
export async function getMockUser() {
    try {
        const user = await prisma.user.upsert({
            where: { email: MOCK_USER_EMAIL },
            update: {},
            create: {
                email: MOCK_USER_EMAIL,
                name: 'Admin User',
            },
        });
        return user;
    } catch (error) {
        log.error({ error }, 'Failed to get mock user');
        throw error;
    }
}
