'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { auditDrillQuality, AuditResult } from '@/actions/inspector';
import { Loader2, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuditButtonProps {
    target: string;
    context: string;
    payload: any;
}

export function AuditButton({ target, context, payload }: AuditButtonProps) {
    const [result, setResult] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const handleAudit = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await auditDrillQuality(target, context, payload);
            if (res.success && res.data) {
                setResult(res.data);
            } else {
                toast.error("Audit failed: " + res.error);
            }
        } catch (e) {
            toast.error("Audit request failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="w-full h-12 rounded-xl bg-violet-600/10 border border-violet-500/50 hover:bg-violet-600 hover:text-white text-violet-400 flex items-center justify-center gap-2 transition-all group"
                >
                    <Gavel className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">AI Audit</span>
                </button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-700 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-violet-400 flex items-center gap-2">
                        <Gavel className="w-5 h-5" />
                        AI Quality Audit
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Evaluating content using an independent LLM Judge...
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {!result && !loading && (
                        <div className="text-center py-8">
                            <Button onClick={handleAudit} className="bg-violet-600 hover:bg-violet-700 text-white">
                                Start Audit
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-8 gap-4 text-zinc-400">
                            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                            <span className="text-sm animate-pulse">Analyzing Correctness & Style...</span>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            {/* Score Card */}
                            <div className={cn(
                                "flex items-center justify-between p-4 rounded-xl border",
                                result.score >= 4 ? "bg-emerald-500/10 border-emerald-500/30" :
                                    result.score >= 3 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30"
                            )}>
                                <span className="text-xs font-bold text-zinc-400 uppercase">Quality Score</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={cn(
                                        "text-3xl font-black font-mono",
                                        result.score >= 4 ? "text-emerald-400" :
                                            result.score >= 3 ? "text-amber-400" : "text-rose-400"
                                    )}>{result.score}</span>
                                    <span className="text-sm text-zinc-500 font-mono">/ 5</span>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">CRITIQUE</label>
                                <p className="text-sm text-zinc-300 p-3 bg-black/20 rounded-lg border border-white/5 leading-relaxed">
                                    {result.reason}
                                </p>
                            </div>

                            {/* Redundancy Warning */}
                            {result.redundancy_detected && (
                                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs font-bold">
                                    ⚠️ Redundancy Detected (Synonym abuse)
                                </div>
                            )}

                            {/* Suggestion */}
                            {result.suggested_sentence && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Suggested Sentence</label>
                                    <p className="text-sm text-emerald-300/80 italic p-3 bg-emerald-950/20 rounded-lg border border-emerald-900/50">
                                        "{result.suggested_sentence}"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
