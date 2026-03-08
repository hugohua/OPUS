"use client";

import { useState, useTransition, useEffect } from "react";
import { useTheme } from "next-themes";
import { updateUserSettings, UserSettings } from "@/actions/update-user-settings";
import { EnginePreferencesDialog } from "@/components/dashboard/engine-preferences-dialog";
import { SlidersHorizontal, Moon, Sun, Volume2, Vibrate, Gauge } from "lucide-react";

/**
 * 偏好设置开关
 */
export function PreferenceToggle({ settings }: { settings: UserSettings }) {
    const [autoPlay, setAutoPlay] = useState(settings.autoPlay ?? true);
    const [haptic, setHaptic] = useState(settings.hapticFeedback ?? false);
    const [isPending, startTransition] = useTransition();
    const [engineDialogOpen, setEngineDialogOpen] = useState(false);
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = mounted ? resolvedTheme === "dark" : true;

    const handleToggle = (key: "autoPlay" | "hapticFeedback", current: boolean) => {
        const newVal = !current;

        // 乐观更新
        if (key === "autoPlay") setAutoPlay(newVal);
        else setHaptic(newVal);

        startTransition(async () => {
            const result = await updateUserSettings({ key, value: newVal });
            if (!result.success) {
                // 回滚
                if (key === "autoPlay") setAutoPlay(current);
                else setHaptic(current);
            }
        });
    };

    return (
        <>
            <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {/* 主题切换 */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400">
                            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">外观主题</span>
                            <span className="text-[10px] text-zinc-400">{isDark ? "深色" : "浅色"}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setTheme(isDark ? "light" : "dark")}
                        className={`w-10 h-6 rounded-full relative transition-colors ${isDark ? 'bg-violet-500' : 'bg-zinc-200 dark:bg-zinc-700'
                            } cursor-pointer`}
                    >
                        <div
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isDark ? 'right-1' : 'left-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Auto-play Audio */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                            <Volume2 className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">自动播放音频</span>
                            <span className="text-[10px] text-zinc-400">卡片出现时自动播放发音</span>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggle("autoPlay", autoPlay)}
                        disabled={isPending}
                        className={`w-10 h-6 rounded-full relative transition-colors ${autoPlay ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                            } ${isPending ? 'opacity-50' : 'cursor-pointer'}`}
                    >
                        <div
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${autoPlay ? 'right-1' : 'left-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Haptic Feedback */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400">
                            <Vibrate className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">触觉反馈</span>
                            <span className="text-[10px] text-zinc-400">正确/错误时振动提示</span>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggle("hapticFeedback", haptic)}
                        disabled={isPending}
                        className={`w-10 h-6 rounded-full relative transition-colors ${haptic ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                            } ${isPending ? 'opacity-50' : 'cursor-pointer'}`}
                    >
                        <div
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${haptic ? 'right-1' : 'left-1'
                                }`}
                        />
                    </button>
                </div>

                {/* 引擎调度偏好 */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400">
                            <Gauge className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">引擎调度偏好</span>
                            <span className="text-[10px] text-zinc-400">调整复习/新词比例策略</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setEngineDialogOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        设置
                    </button>
                </div>
            </div>
            <EnginePreferencesDialog open={engineDialogOpen} onOpenChange={setEngineDialogOpen} />
        </>
    );
}
