import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

export type ScenarioTheme = "cyan" | "emerald" | "violet" | "amber" | "rose" | "indigo";

export interface SimulateScenarioCardProps {
    title: string;
    desc: string;
    tag: string;
    icon: LucideIcon;
    theme?: ScenarioTheme;
    /** 传入 href 时渲染为 Next.js Link，启用路由预加载 */
    href?: string;
    /** 无跳转场景时使用 onClick 回调 */
    onClick?: () => void;
}

const themeStyles: Record<ScenarioTheme, {
    hoverBorder: string;
    iconHover: string;
    tagText: string;
    tagBg: string;
}> = {
    cyan: {
        hoverBorder: "hover:border-cyan-500/40 dark:hover:border-cyan-500/40",
        iconHover: "group-hover:text-cyan-500",
        tagText: "text-cyan-600 dark:text-cyan-500",
        tagBg: "bg-cyan-100/50 dark:bg-cyan-950/30",
    },
    emerald: {
        hoverBorder: "hover:border-emerald-500/40 dark:hover:border-emerald-500/40",
        iconHover: "group-hover:text-emerald-500",
        tagText: "text-emerald-600 dark:text-emerald-500",
        tagBg: "bg-emerald-100/50 dark:bg-emerald-950/30",
    },
    violet: {
        hoverBorder: "hover:border-violet-500/40 dark:hover:border-violet-500/40",
        iconHover: "group-hover:text-violet-500",
        tagText: "text-violet-600 dark:text-violet-500",
        tagBg: "bg-violet-100/50 dark:bg-violet-950/30",
    },
    amber: {
        hoverBorder: "hover:border-amber-500/40 dark:hover:border-amber-500/40",
        iconHover: "group-hover:text-amber-500",
        tagText: "text-amber-600 dark:text-amber-500",
        tagBg: "bg-amber-100/50 dark:bg-amber-950/30",
    },
    rose: {
        hoverBorder: "hover:border-rose-500/40 dark:hover:border-rose-500/40",
        iconHover: "group-hover:text-rose-500",
        tagText: "text-rose-600 dark:text-rose-500",
        tagBg: "bg-rose-100/50 dark:bg-rose-950/30",
    },
    indigo: {
        hoverBorder: "hover:border-indigo-500/40 dark:hover:border-indigo-500/40",
        iconHover: "group-hover:text-indigo-500",
        tagText: "text-indigo-600 dark:text-indigo-500",
        tagBg: "bg-indigo-100/50 dark:bg-indigo-950/30",
    },
};

export function SimulateScenarioCard({
    title,
    desc,
    tag,
    icon: Icon,
    href,
    onClick,
    theme = "cyan"
}: SimulateScenarioCardProps) {
    const styles = themeStyles[theme];

    const baseClassName = cn(
        "group relative flex p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all active:opacity-90 md:active:opacity-100 text-left items-center",
        styles.hoverBorder
    );

    // 公共卡片内容
    const content = (
        <>
            <div className="w-12 h-12 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                <Icon className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors", styles.iconHover)} />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-zinc-900 dark:text-zinc-100 font-bold">{title}</h3>
                    <span className={cn("text-[9px] font-mono px-1 rounded", styles.tagText, styles.tagBg)}>
                        {tag}
                    </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">{desc}</p>
            </div>
        </>
    );

    // 优先使用 Link（激活 Next.js 路由预加载）
    if (href) {
        return (
            <Link href={href} onClick={onClick} className={baseClassName}>
                {content}
            </Link>
        );
    }

    // 无跳转场景降级为 button
    return (
        <button onClick={onClick} className={baseClassName}>
            {content}
        </button>
    );
}
