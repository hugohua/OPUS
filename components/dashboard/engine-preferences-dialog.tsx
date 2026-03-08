'use client';

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getUserSettings, updateUserSettings, EnginePreferences } from "@/actions/update-user-settings";
import { SlidersHorizontal, Save, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────
// 策略选项定义
// ─────────────────────────────────────
const INTAKE_OPTIONS: {
    value: number;
    label: string;
    desc: string;
    hoverAccent: string;
    labelColor?: string;
    isDefault?: boolean;
}[] = [
        {
            value: 0.9,
            label: "稳扎稳打 (Consolidate)",
            desc: "90% 复习旧词，极少引入新词",
            hoverAccent: "hover:border-zinc-400 dark:hover:border-zinc-500",
        },
        {
            value: 0.7,
            label: "标准均衡 (Balanced)",
            desc: "70% 复习旧词，30% 挑选新词",
            hoverAccent: "hover:border-indigo-400 dark:hover:border-indigo-500",
            isDefault: true,
        },
        {
            value: 0.4,
            label: "激进拓展 (Aggressive)",
            desc: "40% 复习旧词，60% 大幅引入新词",
            labelColor: "text-rose-600 dark:text-rose-400",
            hoverAccent: "hover:border-rose-400 dark:hover:border-rose-500",
        },
    ];

interface EnginePreferencesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EnginePreferencesDialog({ open, onOpenChange }: EnginePreferencesDialogProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [prefs, setPrefs] = React.useState<EnginePreferences>({
        review_ratio: 0.7
    });

    React.useEffect(() => {
        if (open) {
            // 每次打开时重置为默认状态，防止上次残留
            setPrefs({ review_ratio: 0.7 });
            setIsLoading(true);
            getUserSettings().then(settings => {
                if (settings.engine_preferences?.review_ratio !== undefined) {
                    setPrefs({ review_ratio: settings.engine_preferences.review_ratio });
                }
                setIsLoading(false);
            }).catch(() => {
                setIsLoading(false);
                toast.error("加载配置失败，请重试");
            });
        }
    }, [open]);

    const handleSave = async () => {
        setIsSaving(true);
        const res = await updateUserSettings({
            key: "engine_preferences",
            value: prefs
        });
        setIsSaving(false);
        if (res.success) {
            toast.success("偏好设置已保存，按新调度策略生效");
            onOpenChange(false);
            router.refresh();
        } else {
            toast.error("保存失败，请重试");
        }
    };

    const isSelected = (value: number) => prefs.review_ratio === value;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
                {/* ── Header ── */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        引擎调度偏好
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        调整复习旧词与引入新词的比例，定制您的专属训练节奏。
                    </DialogDescription>
                </DialogHeader>

                {/* ── Body ── */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
                            <span className="text-sm text-zinc-500 font-mono">正在加载配置...</span>
                        </div>
                    ) : (
                        <section>
                            {/* Section 标题 */}
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                    新词引入节奏
                                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs font-normal ml-1">(Intake)</span>
                                </h3>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400">
                                    复习: {Math.round(prefs.review_ratio * 100)}%
                                </span>
                            </div>

                            {/* 选项卡片 */}
                            <div className="space-y-2">
                                {INTAKE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPrefs({ review_ratio: opt.value })}
                                        className={cn(
                                            "w-full flex items-center p-3 rounded-lg transition-all text-left",
                                            isSelected(opt.value)
                                                ? "border-2 border-indigo-600 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/5"
                                                : cn("border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900", opt.hoverAccent),
                                        )}
                                    >
                                        {/* 自定义 Radio 圆点 */}
                                        <div
                                            className={cn(
                                                "w-4 h-4 rounded-full flex-shrink-0 mr-3 transition-all",
                                                isSelected(opt.value)
                                                    ? "border-4 border-indigo-600 dark:border-indigo-500 bg-white dark:bg-zinc-900"
                                                    : "border border-zinc-300 dark:border-zinc-600"
                                            )}
                                        />
                                        <div>
                                            <h4 className={cn(
                                                "text-sm",
                                                isSelected(opt.value)
                                                    ? "font-bold text-indigo-800 dark:text-indigo-300"
                                                    : cn("font-medium text-zinc-700 dark:text-zinc-300", opt.labelColor)
                                            )}>
                                                {opt.label}
                                                {opt.isDefault && (
                                                    <span className="ml-1.5 text-[10px] font-normal text-zinc-400 dark:text-zinc-500">系统默认</span>
                                                )}
                                            </h4>
                                            <p className={cn(
                                                "text-xs mt-0.5",
                                                isSelected(opt.value)
                                                    ? "text-indigo-600/70 dark:text-indigo-400/70"
                                                    : "text-zinc-400 dark:text-zinc-500"
                                            )}>
                                                {opt.desc}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-end">
                    <button
                        disabled={isLoading || isSaving}
                        onClick={handleSave}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all h-10 px-6 w-full sm:w-auto",
                            "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900",
                            "shadow-[0_3px_0_theme(colors.zinc.950)] dark:shadow-[0_3px_0_theme(colors.zinc.300)]",
                            "hover:bg-zinc-800 dark:hover:bg-zinc-100",
                            "active:translate-y-[3px] active:shadow-none",
                            "disabled:opacity-50 disabled:pointer-events-none",
                        )}
                    >
                        {isSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 opacity-60" />
                        )}
                        {isSaving ? "保存中..." : "应用调度偏好"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
