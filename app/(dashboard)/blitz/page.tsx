/**
 * Blitz Mode Page
 * 功能：
 *   服务端页面，负责获取初始 Session 数据。
 *   如果获取失败或无数据，显示相应提示。
 */
import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getBlitzSession } from '@/actions/get-blitz-session';
import { BlitzSession } from '@/components/blitz/blitz-session';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Phrase Blitz | OPUS',
    description: 'High-velocity vocabulary review.',
};

export default async function BlitzPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const { data: blitzData, message } = await getBlitzSession();

    if (!blitzData || blitzData.items.length === 0) {
        return (
            <div className="container max-w-md mx-auto min-h-[80vh] flex flex-col items-center justify-center space-y-6 text-center">
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">All Caught Up!</h1>
                    <p className="text-muted-foreground">
                        {message === 'No items due for review'
                            ? "You've reviewed all your due words for now."
                            : "Could not load session. Please try again."}
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container max-w-md mx-auto py-6 min-h-screen relative">
            {/* Minimalist Header (Optional Back Button) */}
            <div className="absolute top-4 left-4 z-50">
                <Button variant="ghost" size="icon" asChild className="opacity-50 hover:opacity-100">
                    <Link href="/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
            </div>

            <BlitzSession
                initialData={blitzData}
                userId={session.user.id}
            />
        </div>
    );
}
