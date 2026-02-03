/**
 * Session 页面入口
 * 功能：
 *   根据 mode 参数渲染对应的训练模式
 *   不在 SSR 阶段加载数据（避免 LLM 阻塞）
 *   数据由 SessionRunner 客户端异步获取
 */
import { notFound } from 'next/navigation';
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

    const validModes = ['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ', 'PHRASE', 'CONTEXT'];
    if (!validModes.includes(modeRaw)) {
        notFound();
    }
    const mode = modeRaw as SessionMode;

    // ⚡️ 关键优化：不在 SSR 阶段获取数据
    // 数据由 SessionRunner 客户端异步加载
    // 用户立即看到骨架屏而不是白屏

    return (
        <SessionRunner
            userId={userId}
            mode={mode}
        // initialPayload 不传，触发客户端加载模式
        />
    );
}
