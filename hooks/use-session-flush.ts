import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * [V3.1] 双重结算机制 Hook
 * 1. beforeunload: 浏览器关闭/刷新
 * 2. cleanup (route change): 应用内路由跳转
 */
export function useSessionFlush(userId: string) {
    const pathname = usePathname();

    // 1. 处理 Tab 关闭 / 浏览器刷新
    useEffect(() => {
        const handleUnload = () => {
            // 使用 sendBeacon 保证在页面卸载时能发出请求
            const blob = new Blob([JSON.stringify({ userId })], { type: 'application/json' });
            navigator.sendBeacon('/api/session/flush', blob);
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [userId]);

    // 2. 处理 App 内路由跳转 (Next.js cleanup)
    useEffect(() => {
        return () => {
            // 组件卸载时触发 (例如离开 /session 页面)
            // 使用 keepalive 确保请求完成
            fetch('/api/session/flush', {
                method: 'POST',
                body: JSON.stringify({ userId }),
                headers: { 'Content-Type': 'application/json' },
                keepalive: true
            }).catch(console.error);
        };
    }, [pathname, userId]);
}
