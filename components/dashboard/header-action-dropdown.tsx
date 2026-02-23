'use client';

import * as React from "react";
import { MoreVertical, History, GitBranch, RefreshCw, SlidersHorizontal, ActivitySquare, Eraser } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HeaderActionDropdownProps {
    variant: 'arena' | 'simulate';
    className?: string;
}

export function HeaderActionDropdown({ variant, className }: HeaderActionDropdownProps) {
    const router = useRouter();
    const [isPending, startTransition] = React.useTransition();

    const handleAction = (action: () => void | Promise<void>, loadingMsg?: string) => {
        if (loadingMsg) {
            toast.loading(loadingMsg);
        }
        startTransition(async () => {
            try {
                await action();
                if (loadingMsg) toast.dismiss();
            } catch (error) {
                toast.error("操作失败，请重试");
                console.error(error);
            }
        });
    };

    if (variant === 'arena') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}>
                    <MoreVertical className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg">
                    <DropdownMenuLabel className="text-xs font-mono font-bold text-zinc-500 tracking-widest uppercase">Arena Console</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => router.push('/dashboard/arena/audit-log')}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <History className="w-4 h-4 text-zinc-400" />
                        <span>错题收容所 (Audit Log)</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => router.push('/dashboard/arena?tab=matrix')}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <GitBranch className="w-4 h-4 text-zinc-400" />
                        <span>语法技能树 (Syntax Tree)</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => handleAction(async () => {
                            // TODO: Add actual server action to clear radar cache
                            await new Promise(r => setTimeout(r, 800));
                            toast.success("雷达诊断数据已重置");
                            router.refresh();
                        }, "正在重置引擎状态...")}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-rose-600 dark:text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-500/10 focus:text-rose-600 dark:focus:text-rose-500"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>强制重新诊断</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    if (variant === 'simulate') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}>
                    <MoreVertical className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg">
                    <DropdownMenuLabel className="text-xs font-mono font-bold text-zinc-500 tracking-widest uppercase">Dojo Console</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => toast.info("引擎调度偏好面板建设中...")}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                        <span>引擎调度偏好</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => toast.info("生成管道监控建设中...")}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <ActivitySquare className="w-4 h-4 text-zinc-400" />
                        <span>生成队列状态</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => handleAction(async () => {
                            // TODO: Add actual server action to clear queue
                            await new Promise(r => setTimeout(r, 800));
                            toast.success("今日任务流缓存已清空");
                            router.refresh();
                        }, "正在清空队列...")}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-rose-600 dark:text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-500/10 focus:text-rose-600 dark:focus:text-rose-500"
                    >
                        <Eraser className="w-4 h-4" />
                        <span>清空今日缓存</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return null;
}
