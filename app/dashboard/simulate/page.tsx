'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Zap, Activity, Brain, Network, Play, FileText, Layers, Split } from 'lucide-react';

// --- Matrix UI Configuration ---
interface ScenarioCard {
    id: string;
    title: string;
    file: string;
    desc: string;
    queue: number;
    icon: React.ElementType;
    mode: string;
    color: string;
}

const L0_SCENARIOS: ScenarioCard[] = [
    {
        id: "L0-SYNTAX",
        title: "语法核心",
        file: "", // 内部标识，不展示
        desc: "S-V-O 结构训练",
        queue: 12,
        icon: Zap,
        mode: "SYNTAX",
        color: "group-hover:text-amber-500 group-hover:bg-amber-500"
    },
    {
        id: "L0-PHRASE",
        title: "短语扩展",
        file: "", // 内部标识，不展示
        desc: "词组搭配 (1+N)",
        queue: 8,
        icon: Layers,
        mode: "PHRASE",
        color: "group-hover:text-amber-500 group-hover:bg-amber-500"
    },
    {
        id: "L0-BLITZ",
        title: "极速闪卡",
        file: "", // 内部标识，不展示
        desc: "快速识别训练",
        queue: 45,
        icon: Activity,
        mode: "BLITZ",
        color: "group-hover:text-amber-500 group-hover:bg-amber-500"
    }
];

const L1_SCENARIOS: ScenarioCard[] = [
    {
        id: "L1-AUDIO",
        title: "听力训练",
        file: "", // 内部标识，不展示
        desc: "听觉反射 (闭眼模式)",
        queue: 0,
        icon: Play,
        mode: "AUDIO",
        color: "group-hover:text-cyan-500 bg-cyan-950/30 text-cyan-500"
    },
    {
        id: "L1-CHUNKING",
        title: "意群断句",
        file: "", // 内部标识，不展示
        desc: "语流切分训练",
        queue: 0,
        icon: Split,
        mode: "CHUNKING",
        color: "group-hover:text-cyan-500 bg-cyan-950/30 text-cyan-500"
    }
];

const L2_SCENARIOS: ScenarioCard[] = [
    {
        id: "L2-CONTEXT",
        title: "语境填空",
        file: "", // 内部标识，不展示
        desc: "逻辑填空 (Part 5/6)",
        queue: 0,
        icon: FileText,
        mode: "CONTEXT",
        color: "group-hover:text-violet-400 text-zinc-500"
    },
    {
        id: "L2-NUANCE",
        title: "精准辨析",
        file: "", // 内部标识，不展示
        desc: "词义辨析 (Part 7)",
        queue: 0,
        icon: Brain,
        mode: "NUANCE",
        color: "group-hover:text-violet-400 text-zinc-500"
    }
];

export default function SimulatePage() {
    const router = useRouter();

    const handleNavigate = (mode: string) => {
        // 直接跳转到单一场景模式（不带 scenario 参数）
        router.push(`/dashboard/session/${mode}`);
    };

    return (
        <div className="relative min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 font-sans antialiased selection:bg-indigo-500/30 pb-20">

            {/* Background Grid */}


            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/15 px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                        <Network className="w-4 h-4 text-zinc-600 dark:text-zinc-100" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">训练矩阵</h1>
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">v3.0.1 • 8 个模块</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-500">READY</span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-8 relative z-10">

                {/* --- L0 Foundation --- */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-500 bg-amber-100/50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/50">L0</span>
                        <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">基础层</h2>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 ml-2"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {L0_SCENARIOS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.mode)}
                                    className="group relative flex flex-col p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all text-left overflow-hidden"
                                >
                                    <div className="flex justify-between items-start w-full mb-3">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                                            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">{item.mode}</span>
                                        </div>
                                        <span className={cn("w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 transition-colors", item.color)}></span>
                                    </div>
                                    <h3 className="text-zinc-900 dark:text-zinc-100 font-bold mb-1">{item.title}</h3>


                                    <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col items-start w-full gap-1">
                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-600">{item.desc}</span>
                                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-500">Queue: {item.queue}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* --- L1 Sensory --- */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-500 bg-cyan-100/50 dark:bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-200/50 dark:border-cyan-900/50">L1</span>
                        <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">感知层</h2>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 ml-2"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {L1_SCENARIOS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.mode)}
                                    className="group relative flex p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all text-left items-center"
                                >
                                    <div className="w-12 h-12 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                                        <Icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-cyan-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-zinc-900 dark:text-zinc-100 font-bold">{item.title}</h3>
                                            <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-500 bg-cyan-100/50 dark:bg-cyan-950/30 px-1 rounded">{item.mode}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">{item.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* --- L2 Context --- */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-500 bg-violet-100/50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded border border-violet-200/50 dark:border-violet-900/50">L2</span>
                        <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">语境层</h2>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 ml-2"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {L2_SCENARIOS.map((item) => {
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.mode)}
                                    className="group relative p-5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all text-left"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-zinc-900 dark:text-zinc-100 font-bold">{item.title}</h3>
                                        <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-500 group-hover:text-violet-500 dark:group-hover:text-violet-400">{item.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={cn("w-1.5 h-1.5 rounded-full", item.id === "L2-CONTEXT" ? "bg-violet-500" : "bg-rose-500")}></span>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                                    </div>

                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* --- L3 Synthesis (Static) --- */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-600 bg-zinc-100/50 dark:bg-zinc-800/30 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">L3</span>
                        <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-widest">综合层</h2>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 ml-2"></div>
                    </div>

                    <div className="relative p-5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-zinc-100/50 dark:bg-zinc-900/20 opacity-60 flex items-center justify-between group cursor-not-allowed">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded bg-white dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                                <FileText className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                            </div>
                            <div>
                                <h3 className="text-zinc-400 dark:text-zinc-400 font-bold">文章编织 (Weaver)</h3>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono mt-0.5">文章编织引擎</p>
                            </div>
                        </div>
                        <span className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono text-zinc-500">PENDING</span>
                    </div>
                </section>

            </main>
        </div>
    );
}
