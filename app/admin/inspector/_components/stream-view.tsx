'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    Pause,
    Play,
    Trash2,
    ThumbsUp,
    ThumbsDown
} from 'lucide-react';
import { toast } from 'sonner';
import { saveBadCase } from '@/app/actions/inspector';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AuditButton } from './audit-button';

// Mock Data for Initial State (to show structure)
interface DrillItem {
    id: string;
    time: string;
    target: string;
    context: string;
    status: 'success' | 'generating' | 'error';
    payload?: any;
    debug?: {
        systemPrompt: string;
        userPrompt: string;
        model?: string;
    };
}

// Mock Data Removed - Using Real History


export function GeneratorStreamView() {
    // State
    const [queue, setQueue] = useState<DrillItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);

    // Ref for accessing latest pause state in event callback
    const isPausedRef = useRef(isPaused);
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Fetch History on Mount
    useEffect(() => {
        fetch('/api/admin/history')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.items)) {
                    const history = data.items.map((d: any) => ({
                        id: d.id,
                        time: 'History', // Could parse timestamp
                        target: d.payload?.meta?.target_word || 'Unknown',
                        context: `${d.payload?.meta?.format || 'Unknown'} / ${d.payload?.meta?.mode || 'Unknown'}`,
                        status: d.status,
                        payload: d.payload,
                        debug: d.debug
                    }));
                    setQueue(history);
                    if (history.length > 0) setSelectedId(history[0].id);
                }
            })
            .catch(err => console.error('Failed to load history', err));
    }, []);

    // SSE Connection
    useEffect(() => {
        const evtSource = new EventSource('/api/admin/stream');
        // ... (rest of SSE logic)

        evtSource.onmessage = (event) => {
            if (isPausedRef.current) return;

            try {
                const data = JSON.parse(event.data);

                // Transform data
                console.log("[Stream] RX:", data); // DEBUG
                const newItem: DrillItem = {
                    id: data.id,
                    time: 'Live', // In production use date-fns relative time
                    target: data.payload?.meta?.target_word || 'Unknown',
                    context: `${data.payload?.meta?.format || 'Unknown'} / ${data.payload?.meta?.mode || 'Unknown'}`,
                    status: data.status,
                    payload: data.payload,
                    debug: data.debug
                };

                setQueue(prev => {
                    const newQueue = [newItem, ...prev];
                    return newQueue.slice(0, 50); // Keep last 50
                });

                // Auto-select latest if user is viewing the top
                // Logic can be refined later
            } catch (e) {
                console.error("[Stream] Parse Error", e);
            }
        };

        evtSource.onerror = (err) => {
            // Reconnection is handled automatically by EventSource usually, but logging helps
            console.error("[Stream] Connection Error", err);
            // evtSource.close(); // Don't close, let it retry
        };

        return () => {
            evtSource.close();
        };
    }, []);

    const handleClear = async () => {
        // Confirmation handled by AlertDialog

        try {
            await fetch('/api/admin/history', { method: 'DELETE' });
            setQueue([]);
            setSelectedId(null);
            toast.success('History buffer cleared');
        } catch (e) {
            toast.error('Failed to clear history');
        }
    };

    const handleBadCase = async () => {
        const item = queue.find(q => q.id === selectedId);
        if (!item) return;

        toast.promise(
            saveBadCase({
                id: item.id,
                targetWord: item.target,
                promptConstraints: "Focus on business context...", // Mock logic
                output: item.payload || {},
                reason: "User flagged as Bad Case"
            }),
            {
                loading: 'Saving to negative samples...',
                success: 'Bad case saved! AI will learn from this.',
                error: 'Failed to save bad case'
            }
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">

            {/* Header */}
            <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-900/30 backdrop-blur">
                <h2 className="text-lg font-bold text-zinc-200">Real-time Stream</h2>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-zinc-500">Queue: {queue.length} items</span>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="p-1.5 rounded-md hover:bg-rose-500/10 text-zinc-500 hover:text-rose-500 transition-colors"
                                title="Clear History"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Clear History Buffer?</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400">
                                    This will delete the recent drill history from the Redis buffer.
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClear} className="bg-rose-600 hover:bg-rose-700 text-white border-0">
                                    Clear History
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={cn(
                            "px-3 py-1.5 rounded-md border text-xs flex items-center gap-2 transition-colors",
                            isPaused
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                        )}
                    >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        {isPaused ? "Resume Stream" : "Pause Stream"}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">

                {/* Left List */}
                <div className="w-80 shrink-0 border-r border-white/5 overflow-y-auto bg-black/20">
                    {queue.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={cn(
                                "p-4 border-b border-white/5 cursor-pointer transition-colors",
                                selectedId === item.id
                                    ? "bg-white/5 border-l-2 border-l-violet-500"
                                    : "opacity-60 hover:opacity-100 hover:bg-white/5 border-l-2 border-l-transparent"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-[10px] font-mono",
                                    item.status === 'error' ? "text-rose-500" : "text-violet-400"
                                )}>#{item.id}</span>
                                <span className="text-[10px] text-zinc-500">{item.time}</span>
                            </div>
                            <div className="text-sm font-bold text-white mb-1">Target: {item.target}</div>
                            <div className={cn(
                                "text-[10px]",
                                item.status === 'error' ? "text-rose-400" : "text-zinc-400"
                            )}>
                                {item.status === 'error' ? 'JSON Parse Error' : `Context: ${item.context}`}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                {(() => {
                    const activeItem = queue.find(q => q.id === selectedId) || queue[0];
                    if (!activeItem) return (
                        <div className="flex-1 p-8 flex items-center justify-center text-zinc-500 bg-zinc-950/50">
                            Waiting for stream data...
                        </div>
                    );

                    // Safe access to payload
                    // Drill payload structure: { meta: {}, segments: [] }
                    const segments = activeItem.payload?.segments || [];
                    const interaction = segments.find((s: any) => s.type === 'interaction');
                    const meta = activeItem.payload?.meta || {};

                    return (
                        <div className="flex-1 overflow-y-auto p-8 flex gap-8 bg-zinc-950/50">

                            {/* Column 1: Input Context */}
                            <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">Input Context</span>
                                </div>

                                <div className="w-full bg-zinc-900 rounded-xl border border-white/10 p-4 font-mono text-xs text-zinc-300 leading-relaxed overflow-x-auto">
                                    <div className="text-zinc-500">// Meta</div>
                                    <div className="pl-4"><span className="text-violet-400">"id"</span>: <span className="text-emerald-400">"{activeItem.id}"</span></div>
                                    <br />
                                    <div className="text-zinc-500">// Payload Meta</div>
                                    <pre className="text-zinc-400">{JSON.stringify(meta, null, 2)}</pre>

                                    {activeItem.debug && (
                                        <>
                                            <br />
                                            <div className="text-zinc-500">// System Prompt</div>
                                            <pre className="text-amber-500/80 whitespace-pre-wrap">{activeItem.debug.systemPrompt}</pre>
                                            <br />
                                            <div className="text-zinc-500">// User Prompt</div>
                                            <pre className="text-sky-500/80 whitespace-pre-wrap">{activeItem.debug.userPrompt}</pre>

                                            {activeItem.debug.model && (
                                                <>
                                                    <br />
                                                    <div className="text-zinc-500">// Model</div>
                                                    <pre className="text-purple-400 font-bold">{activeItem.debug.model}</pre>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Rendered Output (Light Mode Preview) */}
                            <div className="flex-1 flex flex-col gap-4 min-w-[350px]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">Rendered Output</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-600">Model: GPT-4o-mini</span>
                                </div>

                                {/* The Preview Card - Light Mode Only */}
                                <div className="w-full bg-zinc-50 text-zinc-900 rounded-2xl p-6 shadow-2xl relative">
                                    <div className="absolute top-4 right-4 text-[10px] font-mono text-zinc-400 border border-zinc-200 px-1 rounded">PREVIEW</div>

                                    {interaction ? (
                                        <>
                                            <h3 className="font-serif text-xl leading-relaxed text-center mt-4">
                                                {/* Simplified rendering of markdown */}
                                                {interaction.task?.question_markdown || "No question content"}
                                            </h3>

                                            <div className="grid grid-cols-2 gap-3 mt-8">
                                                {interaction.task?.options?.map((opt: any) => (
                                                    <div key={typeof opt === 'string' ? opt : opt.text} className="p-3 rounded-xl border border-zinc-200 bg-white text-center text-sm">
                                                        {typeof opt === 'string' ? opt : opt.text}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-zinc-200">
                                                <p className="text-[10px] font-mono text-zinc-500 uppercase">Explanation</p>
                                                <p className="text-xs text-zinc-600 mt-1">
                                                    {interaction.task?.explanation_markdown || "No explanation provided."}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-10 opacity-50 font-mono text-xs">
                                            Raw payload view (No interaction found)
                                            <br />
                                            {JSON.stringify(segments.slice(0, 1))}
                                        </div>
                                    )}
                                </div>

                                {/* Audit Action */}
                                <div className="mt-4">
                                    <AuditButton
                                        target={activeItem.target}
                                        context={activeItem.context}
                                        payload={activeItem.payload}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
