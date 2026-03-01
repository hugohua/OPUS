"use client";

import { useSharedUserSettings } from "@/components/providers/user-settings-provider";
import { useCallback } from "react";

/**
 * PWA 专属的触觉反馈系统 (Haptic Touch)
 * 根据用户的 Profile 设置 (hapticFeedback) 决定是否调用 Web Vibration API.
 */
export function useHaptic() {
    const { hapticFeedback } = useSharedUserSettings();

    /**
     * 底层触觉方法，安全检查 navigator.vibrate 支持
     */
    const triggerVibration = useCallback((pattern: number | number[]) => {
        if (!hapticFeedback) return;
        if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
            try {
                window.navigator.vibrate(pattern);
            } catch (error) {
                // Ignore vibration errors (e.g. strict policy, desktop browsers without API)
            }
        }
    }, [hapticFeedback]);

    return {
        /**
         * 极轻微的触感 (例如: 点击导航栏底部菜单)
         * - Android: 短促 10ms 左右
         * - iOS: iOS 浏览器不支持 Web Vibration API, 安全失败
         */
        vibrateLight: useCallback(() => triggerVibration(10), [triggerVibration]),

        /**
         * 成功事件 (例如: 答题正确 - Ticking + Pop)
         * - 2 次连续短促震动
         */
        vibrateSuccess: useCallback(() => triggerVibration([30, 50, 40]), [triggerVibration]),

        /**
         * 错误事件 (例如: 答题错误 - Heavy buzz)
         * - 1 次或多次沉闷的长震动
         */
        vibrateError: useCallback(() => triggerVibration([80, 50, 100]), [triggerVibration]),

        /**
         * 关键选择事件 (例如: 开始生成 Weaver)
         * - 单次力量适中的阻尼震动
         */
        vibrateSelection: useCallback(() => triggerVibration(40), [triggerVibration]),
    };
}
