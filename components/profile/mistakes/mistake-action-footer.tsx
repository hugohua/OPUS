'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { archiveMistake } from '@/actions/mistake-actions';

interface MistakeActionFooterProps {
    mistakeId: string;
    grammarNodeId?: string | null;
    questionType?: string | null;
    part: number;
}

export function MistakeActionFooter({ mistakeId, grammarNodeId, questionType, part }: MistakeActionFooterProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isArchiving, setIsArchiving] = useState(false);

    const handleArchive = async () => {
        setIsArchiving(true);
        startTransition(async () => {
            const result = await archiveMistake(mistakeId);
            if (result.status === 'success') {
                router.push('/dashboard/profile/mistakes');
            } else {
                console.error(result.message);
                setIsArchiving(false);
            }
        });
    };

    // 决定相似题的跳转目标
    let similarUrl = '/dashboard/arena/mission'; // 阅读类默认
    if (grammarNodeId) {
        similarUrl = `/dashboard/arena/blitz?node=${grammarNodeId}`;
    } else if (part === 5 || questionType === 'GRAMMAR' || questionType === 'VOCABULARY') {
        similarUrl = '/dashboard/arena/blitz';
    }

    return (
        <footer className="fixed bottom-0 w-full max-w-md mx-auto p-5 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-40 flex gap-3 pb-8">
            <button
                disabled={isPending || isArchiving}
                onClick={handleArchive}
                className="flex-none px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all text-sm flex justify-center items-center disabled:opacity-50 disabled:active:scale-100"
            >
                {(isPending || isArchiving) ? <Loader2 className="w-4 h-4 animate-spin" /> : '归档'}
            </button>

            <Link
                href={similarUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all h-12 bg-slate-900 text-white shadow-[0_4px_0_#0f172a] hover:bg-slate-800 active:translate-y-[4px] active:shadow-none"
            >
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                做一题相似题
            </Link>
        </footer>
    );
}
