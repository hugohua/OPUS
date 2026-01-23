import { notFound } from 'next/navigation';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { SessionRunner } from '@/components/session/session-runner';
import { SessionMode } from '@/types/briefing';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ mode: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SessionPage(props: PageProps) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const userId = session.user.id;
    const modeRaw = params.mode.toUpperCase();

    const validModes = ['SYNTAX', 'CHUNKING', 'NUANCE'];
    if (!validModes.includes(modeRaw)) {
        notFound();
    }
    const mode = modeRaw as SessionMode;

    const result = await getNextDrillBatch({
        userId,
        mode,
        limit: 10
    });

    if (result.status === 'error' || !result.data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
                <h2 className="text-xl font-bold text-destructive">Mission Failed</h2>
                <p className="text-muted-foreground">{result.message}</p>
            </div>
        );
    }

    return (
        <SessionRunner
            initialPayload={result.data}
            userId={userId}
            mode={mode}
        />
    );
}
