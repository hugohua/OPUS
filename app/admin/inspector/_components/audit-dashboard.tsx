'use client';

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { getPanoramicStats, getPanoramicLogs, PanoramicStats } from '@/actions/audit-actions';
import { auditDrillQuality } from '@/actions/inspector';
import { RefreshCcw, AlertCircle, CheckCircle, Brain, Filter, ChevronRight, HelpCircle, Sparkles, Loader2 } from 'lucide-react';
import { DrillCardPreview } from '@/components/admin/drill-card-preview';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from "@/components/ui/drawer";

// --- Types ---
type FilterType = 'ALL' | 'OMPS' | 'FSRS' | 'LLM' | 'ANOMALY';

// --- Sub-component: Log Detail View ---
function LogDetailContent({ log, onAuditUpdate }: { log: any, onAuditUpdate?: (newLog: any) => void }) {
    const [isAuditing, startAudit] = useTransition();

    const handleAudit = () => {
        if (!log || isAuditing) return;

        startAudit(async () => {
            try {
                const result = await auditDrillQuality(
                    log.targetWord,
                    log.contextMode,
                    log.payload
                );

                if (result.success && result.data) {
                    toast.success('AI 审计完成');
                    // Optimistic update or callback to refresh parent
                    if (onAuditUpdate) {
                        onAuditUpdate({
                            ...log,
                            auditScore: result.data.score,
                            auditReason: result.data.reason,
                            status: 'AUDIT'
                        });
                    }
                } else {
                    toast.error('审计失败: ' + result.error);
                }
            } catch (e) {
                toast.error('审计调用异常');
            }
        });
    };

    // Safe access to payload for visual preview
    const segments = log?.payload?.segments || [];
    const interaction = segments.find((s: any) => s.type === 'interaction');
    const task = interaction?.task;

    if (!log) return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 p-8">
            <Brain className="w-16 h-16 mb-4" />
            <p>选择一条日志查看详情</p>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-8 p-4 md:p-8 pb-32">
            {/* Meta Card */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="text-violet-500">目标词:</span>
                        {log.targetWord}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            log.auditScore >= 5 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                                log.auditScore >= 3 ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                                    log.auditScore > 0 ? "bg-rose-500/10 text-rose-600 border-rose-200" :
                                        "bg-zinc-100 text-zinc-500 border-zinc-200"
                        )}>
                            {log.auditScore ? `Score: ${log.auditScore}` : '无评分'}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">#{log.id.slice(0, 8)}...</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-muted-foreground text-xs uppercase mb-1">上下文模式</div>
                        <div className="font-mono">{log.contextMode}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase mb-1">时间戳</div>
                        <div className="font-mono">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                </div>

                {/* Audit Reason Display */}
                {log.auditReason && (
                    <div className="mt-4 pt-4 border-t border-dashed">
                        <div className="text-muted-foreground text-xs uppercase mb-1">审计评价</div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            {log.auditReason}
                        </p>
                    </div>
                )}
            </div>

            {/* Visual Preview */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">卡片预览</h4>
                    {!log.auditScore && (
                        <button
                            onClick={handleAudit}
                            disabled={isAuditing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                            {isAuditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {isAuditing ? "正在分析..." : "立即审计"}
                        </button>
                    )}
                </div>

                {task ? (
                    <DrillCardPreview
                        question={task.question_markdown}
                        options={task.options}
                        answer={task.answer_key}
                        explanation={task.explanation_markdown}
                        context="Snapshot"
                    />
                ) : (
                    <div className="p-8 border rounded-xl text-center text-muted-foreground bg-muted/20">
                        无法渲染预览 (无交互数据)
                    </div>
                )}
            </div>

            {/* Tags Warning */}
            {log.auditTags?.length > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-rose-600 mb-1">检测到异常</h4>
                        <div className="flex gap-2 flex-wrap">
                            {log.auditTags.map((t: string) => (
                                <span key={t} className="font-mono text-xs text-rose-500 bg-rose-500/10 px-2 py-1 rounded">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Payload Inspector */}
            <div>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">原始快照</h4>
                <div className="rounded-xl border bg-zinc-100 dark:bg-zinc-950 p-4 overflow-x-auto">
                    <pre className="font-mono text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {JSON.stringify(log.payload, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

// --- Component ---
export function AuditDashboard() {
    const [stats, setStats] = useState<PanoramicStats | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const isDesktop = useMediaQuery("(min-width: 768px)");

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // @ts-ignore - TS might complain about mismatch in Promise array
            const [newStats, newLogs] = await Promise.all([
                getPanoramicStats(),
                getPanoramicLogs(filter)
            ]);
            setStats(newStats as PanoramicStats);
            setLogs(newLogs as any[]);

            // Auto-select first item only on desktop to avoid drawer popping up on mobile load
            if (newLogs.length > 0 && !selectedLog && isDesktop) {
                setSelectedLog(newLogs[0]);
            }
        } catch (error) {
            console.error(error);
            toast.error('加载审计数据失败');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const handleLogSelect = (log: any) => {
        setSelectedLog(log);
        if (!isDesktop) {
            setIsDrawerOpen(true);
        }
    };

    const handleAuditUpdate = (newLog: any) => {
        setLogs(prev => prev.map(l => l.id === newLog.id ? newLog : l));
        setSelectedLog(newLog);
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full bg-background overflow-hidden relative">
                {/* Ambient Background (Low Key) */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/10 via-background to-background pointer-events-none" />

                {/* 1. Header & Stats */}
                <header className="p-6 border-b bg-background/50 backdrop-blur z-10 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-indigo-500">
                            全景审计
                        </h2>
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-95"
                        >
                            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* OMPS */}
                        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <p className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider">选词命中率</p>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <HelpCircle className="w-3 h-3 text-emerald-600/50 hover:text-emerald-600 transition-colors" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs text-xs">
                                                <p className="font-bold mb-1">OMPS 算法选词合规性</p>
                                                <p>公式：1 - (Selection Shortage / Total Requests)</p>
                                                <p className="mt-1 opacity-70">指标 &lt; 98% 意味着库存不足或筛选条件过严，导致用户无法获取足够的生词。</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <h3 className="text-2xl font-bold text-emerald-500 mt-1">{stats?.selectionCompliance ?? '-'}%</h3>
                                </div>
                                <Filter className="w-5 h-5 text-emerald-500/50" />
                            </div>
                            <p className="text-[10px] text-emerald-600/60 mt-2">目标 &gt; 98% (无短缺)</p>
                        </div>

                        {/* FSRS */}
                        <div className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <p className="text-xs font-mono font-bold text-violet-600 uppercase tracking-wider">记忆稳定性</p>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <HelpCircle className="w-3 h-3 text-violet-600/50 hover:text-violet-600 transition-colors" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs text-xs">
                                                <p className="font-bold mb-1">FSRS 记忆保留率稳健性</p>
                                                <p>公式：1 - (Stability Drop / Total Transitions)</p>
                                                <p className="mt-1 opacity-70">指标 &lt; 90% 意味着大量词汇的记忆稳定性出现异常下降，可能预示模型拟合偏差。</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <h3 className="text-2xl font-bold text-violet-500 mt-1">{stats?.retentionRate ?? '-'}%</h3>
                                </div>
                                <Brain className="w-5 h-5 text-violet-500/50" />
                            </div>
                            <p className="text-[10px] text-violet-600/60 mt-2">目标 &gt; 90% (稳定增长)</p>
                        </div>

                        {/* Anomalies */}
                        <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <p className="text-xs font-mono font-bold text-rose-600 uppercase tracking-wider">系统异常</p>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <HelpCircle className="w-3 h-3 text-rose-600/50 hover:text-rose-600 transition-colors" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs text-xs">
                                                <p className="font-bold mb-1">系统全链路异常事件</p>
                                                <p>包含：LLM 生成失败、幻觉检测、库存阻塞、算法降级等。</p>
                                                <p className="mt-1 opacity-70">点击列表筛选 'ANOMALY' 查看详情。</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <h3 className="text-2xl font-bold text-rose-500 mt-1">{stats?.anomalyCount ?? '-'}</h3>
                                </div>
                                <AlertCircle className="w-5 h-5 text-rose-500/50" />
                            </div>
                            <p className="text-[10px] text-rose-600/60 mt-2">当前异常数</p>
                        </div>
                    </div>
                </header>

                {/* 2. Main Content (Split View / Mobile List) */}
                <div className="flex-1 flex overflow-hidden z-0">

                    {/* Log List (Full width on mobile, w-96 on desktop) */}
                    <div className={cn(
                        "flex flex-col bg-background/30",
                        isDesktop ? "w-96 border-r" : "w-full"
                    )}>
                        <div className="p-2 grid grid-cols-5 gap-1 border-b">
                            {(['ALL', 'OMPS', 'FSRS', 'LLM', 'ANOMALY'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={cn(
                                        "px-1 py-1.5 text-[10px] font-bold rounded transition-colors uppercase",
                                        filter === f
                                            ? "bg-violet-500/10 text-violet-500"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {f === 'ANOMALY' ? '⚠' : f}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {logs.map((log) => {
                                const isAnomaly = log.auditTags && log.auditTags.length > 0;
                                const isSelected = selectedLog?.id === log.id;

                                return (
                                    <button
                                        key={log.id}
                                        onClick={() => handleLogSelect(log)}
                                        className={cn(
                                            "w-full text-left p-4 border-b transition-colors relative group",
                                            isSelected && isDesktop ? "bg-accent" : "hover:bg-accent/50"
                                        )}
                                    >
                                        {isSelected && isDesktop && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />}

                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn(
                                                "text-[10px] font-mono",
                                                isAnomaly ? "text-rose-500 font-bold" : "text-violet-400"
                                            )}>
                                                {isAnomaly ? '⚠ ANOMALY' : log.contextMode}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="text-sm font-bold text-foreground truncate flex-1 mr-2">
                                                {log.targetWord}
                                            </div>
                                            {/* Mobile Chevron */}
                                            {!isDesktop && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
                                        </div>

                                        {isAnomaly && (
                                            <div className="flex gap-1 flex-wrap mt-1">
                                                {log.auditTags.map((tag: string) => (
                                                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[9px] border border-rose-500/20">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop: Details Panel */}
                    {isDesktop && (
                        <div className="flex-1 overflow-y-auto bg-muted/10">
                            <LogDetailContent log={selectedLog} onAuditUpdate={handleAuditUpdate} />
                        </div>
                    )}

                    {/* Mobile: Drawer Details */}
                    {!isDesktop && (
                        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                            <DrawerContent className="h-[85vh]">
                                <DrawerHeader className="border-b">
                                    <DrawerTitle>审计详情</DrawerTitle>
                                    <DrawerDescription className="font-mono text-xs">
                                        #{selectedLog?.id}
                                    </DrawerDescription>
                                </DrawerHeader>
                                <div className="flex-1 overflow-y-auto">
                                    <LogDetailContent log={selectedLog} onAuditUpdate={handleAuditUpdate} />
                                </div>
                            </DrawerContent>
                        </Drawer>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
