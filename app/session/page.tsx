import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { InfiniteDrillFlow } from '@/components/drill/infinite-drill-flow';

/**
 * [V3.1] 无限流学习模式入口
 * Route: /session
 */
export default async function SessionPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    return (
        <main className="min-h-screen bg-black">
            <InfiniteDrillFlow userId={session.user.id} />
        </main>
    );
}
