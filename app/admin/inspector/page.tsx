/**
 * Admin Inspector - God View (Desktop Only)
 * Path: app/admin/inspector/page.tsx
 * 
 * 功能：实时监控 LLM 生成流，人工审计 Bad Case。
 * 架构：独立于 Mobile Dashboard，采用全屏桌面布局。
 */
import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { InspectorClient } from './_components/inspector-client';

export const metadata: Metadata = {
    title: 'Opus Inspector | God View',
    description: 'Real-time generator monitoring and feedback loop.',
};

export default async function InspectorPage() {
    const session = await auth();

    // 简单的权限检查 (以后可升级为 Role-based)
    // 目前只要是登录用户即可 (假设 Admin 账号)
    if (!session?.user) {
        redirect('/login');
    }

    return (
        <InspectorClient />
    );
}
