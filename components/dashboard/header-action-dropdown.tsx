'use client';

import * as React from "react";
import { MoreVertical, History, GitBranch, SlidersHorizontal, User, Home } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { EnginePreferencesDialog } from "@/components/dashboard/engine-preferences-dialog";

interface HeaderActionDropdownProps {
    variant: 'arena' | 'simulate' | 'weaver';
    className?: string;
}

export function HeaderActionDropdown({ variant, className }: HeaderActionDropdownProps) {
    const router = useRouter();
    const [isPending] = React.useTransition();
    const [dialogOpen, setDialogOpen] = React.useState(false);



    if (variant === 'arena') {
        return (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}>
                        <MoreVertical className="w-5 h-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg">
                        <DropdownMenuLabel className="text-xs font-mono font-bold text-zinc-500 tracking-widest uppercase">实战控制台</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard/profile')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <User className="w-4 h-4 text-zinc-400" />
                            <span>个人主页</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <Home className="w-4 h-4 text-zinc-400" />
                            <span>返回首页</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard/profile/mistakes')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <History className="w-4 h-4 text-zinc-400" />
                            <span>错题收容所</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard/arena?tab=matrix')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <GitBranch className="w-4 h-4 text-zinc-400" />
                            <span>语法技能树</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => setDialogOpen(true)}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                            <span>引擎调度偏好</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <EnginePreferencesDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            </>
        );
    }

    if (variant === 'simulate') {
        return (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}>
                        <MoreVertical className="w-5 h-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg">
                        <DropdownMenuLabel className="text-xs font-mono font-bold text-zinc-500 tracking-widest uppercase">训练控制台</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard/profile')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <User className="w-4 h-4 text-zinc-400" />
                            <span>个人主页</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <Home className="w-4 h-4 text-zinc-400" />
                            <span>返回首页</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => setDialogOpen(true)}
                            className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
                            <span>引擎调度偏好</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <EnginePreferencesDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            </>
        );
    }

    if (variant === 'weaver') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}>
                    <MoreVertical className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg">
                    <DropdownMenuLabel className="text-xs font-mono font-bold text-zinc-500 tracking-widest uppercase">简报控制台</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-white/10" />

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => router.push('/dashboard/profile')}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <User className="w-4 h-4 text-zinc-400" />
                        <span>个人主页</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 py-2.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                    >
                        <Home className="w-4 h-4 text-zinc-400" />
                        <span>返回首页</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return null;
}
