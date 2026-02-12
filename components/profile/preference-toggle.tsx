"use client";

import { useState, useTransition } from "react";
import { updateUserSettings, UserSettings } from "@/actions/update-user-settings";

/**
 * 偏好设置开关
 */
export function PreferenceToggle({ settings }: { settings: UserSettings }) {
    const [autoPlay, setAutoPlay] = useState(settings.autoPlay ?? true);
    const [haptic, setHaptic] = useState(settings.hapticFeedback ?? false);
    const [isPending, startTransition] = useTransition();

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
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {/* Auto-play Audio */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-medium">自动播放音频</span>
                    <span className="text-[10px] text-zinc-400">卡片出现时自动播放发音</span>
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
                <div className="flex flex-col">
                    <span className="text-sm font-medium">触觉反馈</span>
                    <span className="text-[10px] text-zinc-400">正确/错误时振动提示</span>
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
        </div>
    );
}
