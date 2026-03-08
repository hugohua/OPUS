'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatabaseZap } from 'lucide-react';
import { cleanupAudioCacheAction } from '@/actions/audio-cache-action';
import { toast } from 'sonner';

export function AudioCacheCleanupButton() {
    const [isPending, setIsPending] = useState(false);

    const handleCleanup = async () => {
        setIsPending(true);
        try {
            const result = await cleanupAudioCacheAction();

            if (result.success && result.data) {
                const { validCount, missingCount, deletedCount, orphanDeletedCount } = result.data;

                toast.success('音频缓存清理完成', {
                    description: `保留有效缓存 ${validCount} 条。删除了 ${deletedCount} 条无效记录，清理了 ${orphanDeletedCount} 个孤儿实体文件。`,
                    duration: 5000,
                });
            } else {
                toast.error('清理失败', {
                    description: result.error || '未知错误',
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('请求出错', {
                description: '无法连接服务器',
            });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleCleanup}
            className="gap-2 shrink-0 text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 active:bg-violet-500/20 transition-colors duration-200"
        >
            <DatabaseZap className={`w-4 h-4 ${isPending ? 'animate-spin text-yellow-400' : ''}`} />
            <span className="hidden sm:inline text-xs font-medium">
                {isPending ? '清理中…' : '音频缓存清理'}
            </span>
        </Button>
    );
}
