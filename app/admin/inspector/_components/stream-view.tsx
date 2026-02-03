'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    Pause,
    Play,
    Trash2,
    ChevronDown,
    ChevronUp,
    Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { saveBadCase } from '@/actions/inspector';
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
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from "@/components/ui/drawer";
import { AuditButton } from './audit-button';
import { useMediaQuery } from '@/hooks/use-media-query';

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
    const [isInputExpanded, setIsInputExpanded] = useState(false); // Default collapsed on mobile
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Responsive check
    const isDesktop = useMediaQuery("(min-width: 768px)");

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
                        time: d.createdAt ? new Date(d.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'History',
                        target: d.payload?.meta?.target_word || 'Unknown',
                        context: `${d.payload?.meta?.format || 'Unknown'} / ${d.payload?.meta?.mode || 'Unknown'}`,
                        status: d.status,
                        payload: d.payload,
                        debug: d.debug
                    }));
                    setQueue(history);
                    if (history.length > 0 && isDesktop) setSelectedId(history[0].id);
                }
            })
            .catch(err => console.error('Failed to load history', err));
    }, [isDesktop]);

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

                // Auto-select latest if user is viewing the top AND on desktop
                // On mobile, we don't want to disrupt the list view
                if (isDesktop) {
                    // Logic can be refined later
                }
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
    }, [isDesktop]);

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

    const handleSelect = (id: string) => {
        setSelectedId(id);
        if (!isDesktop) {
            setIsDrawerOpen(true);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    // Component to render details (reused in Split View and Drawer)
    const DetailContent = ({ itemId }: { itemId: string | null }) => {
        const activeItem = queue.find(q => q.id === itemId) || queue[0];
        if (!activeItem) return (
            <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground bg-muted/20">
                Waiting for stream data...
            </div>
        );

        // Safe access to payload
        // Drill payload structure: { meta: {}, segments: [] }
        const segments = activeItem.payload?.segments || [];
        const interaction = segments.find((s: any) => s.type === 'interaction');
        const meta = activeItem.payload?.meta || {};

        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col md:flex-row gap-4 md:gap-8 bg-background/50">

                {/* Column 1: Input Context */}
                <div className="flex-1 flex flex-col gap-4 min-w-0 md:min-w-[300px]">
                    <div
                        className="flex items-center justify-between cursor-pointer md:cursor-default"
                        onClick={() => setIsInputExpanded(!isInputExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Input Context</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(JSON.stringify(meta, null, 2) + "\n\n" + (activeItem.debug?.systemPrompt || "") + "\n\n" + (activeItem.debug?.userPrompt || ""));
                                }}
                                className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-white"
                                title="Copy Content"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                            <div className="md:hidden text-[10px] items-center gap-1 text-muted-foreground flex">
                                {isInputExpanded ? 'Collapse' : 'Expand'}
                                {isInputExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                    <div className={cn(
                        "w-full bg-muted/50 rounded-xl border p-4 font-mono text-xs text-foreground leading-relaxed overflow-x-auto transition-all duration-300 ease-in-out",
                        !isInputExpanded ? "max-h-[120px] md:max-h-none overflow-hidden relative" : "max-h-none opacity-100"
                    )}>
                        {!isInputExpanded && (
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none md:hidden"></div>
                        )}

                        <div className="text-muted-foreground">// Meta</div>
                        <div className="pl-4"><span className="text-violet-500">"id"</span>: <span className="text-emerald-500">"{activeItem.id}"</span></div>
                        <br />
                        <div className="text-muted-foreground">// Payload Meta</div>
                        <pre className="text-muted-foreground/80">{JSON.stringify(meta, null, 2)}</pre>

                        {activeItem.debug && (
                            <>
                                <br />
                                <div className="text-muted-foreground">// System Prompt</div>
                                <pre className="text-amber-500/80 whitespace-pre-wrap">{activeItem.debug.systemPrompt}</pre>
                                <br />
                                <div className="text-muted-foreground">// User Prompt</div>
                                <pre className="text-sky-500/80 whitespace-pre-wrap">{activeItem.debug.userPrompt}</pre>

                                {activeItem.debug.model && (
                                    <>
                                        <br />
                                        <div className="text-muted-foreground">// Model</div>
                                        <pre className="text-purple-500 font-bold">{activeItem.debug.model}</pre>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Column 2: Rendered Output (Light Mode Preview) */}
                <div className="flex-1 flex flex-col gap-4 min-w-0 md:min-w-[350px]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Rendered Output</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">Model: {activeItem.debug?.model || 'Unknown'}</span>
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
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
                    <div className="mt-4 pb-8 md:pb-0">
                        <AuditButton
                            target={activeItem.target}
                            context={activeItem.context}
                            payload={activeItem.payload}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">

            {/* Header */}
            <header className="h-16 shrink-0 border-b flex items-center justify-between px-6 bg-background/30 backdrop-blur">
                <h2 className="text-lg font-bold text-foreground">Real-time Stream</h2>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-muted-foreground">Queue: {queue.length} items</span>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="p-1.5 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                                title="Clear History"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Clear History Buffer?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete the recent drill history from the Redis buffer.
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClear} className="bg-rose-600 hover:bg-rose-700 text-white">
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
                                : "bg-card border-border text-foreground hover:bg-accent"
                        )}
                    >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        {isPaused ? "Resume Stream" : "Pause Stream"}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* List View (Always Visible) */}
                <div className={cn(
                    "w-full bg-background/20 overflow-y-auto",
                    isDesktop ? "w-80 border-r shrink-0 h-full" : "h-full"
                )}>
                    {queue.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item.id)}
                            className={cn(
                                "p-4 border-b cursor-pointer transition-colors relative",
                                selectedId === item.id && isDesktop
                                    ? "bg-accent border-l-2 border-l-violet-500"
                                    : "opacity-80 hover:opacity-100 hover:bg-accent/50 border-l-2 border-l-transparent"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-[10px] font-mono",
                                    item.status === 'error' ? "text-rose-500" : "text-violet-400"
                                )}>#{item.id}</span>
                                <span className="text-[10px] text-muted-foreground">{item.time}</span>
                            </div>
                            <div className="text-sm font-bold text-foreground mb-1">Target: {item.target}</div>
                            <div className={cn(
                                "text-[10px]",
                                item.status === 'error' ? "text-rose-400" : "text-muted-foreground"
                            )}>
                                {item.status === 'error' ? 'JSON Parse Error' : `Context: ${item.context}`}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop: Side-by-Side Details */}
                {isDesktop && (
                    <DetailContent itemId={selectedId} />
                )}

                {/* Mobile: Drawer Details */}
                {!isDesktop && (
                    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                        <DrawerContent className="h-[90vh]">
                            <DrawerHeader className="border-b">
                                <DrawerTitle>Drills Detail</DrawerTitle>
                                <DrawerDescription className="font-mono text-xs">
                                    #{selectedId}
                                </DrawerDescription>
                            </DrawerHeader>
                            <DetailContent itemId={selectedId} />
                        </DrawerContent>
                    </Drawer>
                )}
            </div>
        </div>
    );
}
