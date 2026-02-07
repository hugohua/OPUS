'use client';

import { ArrowLeft, MoreHorizontal, Play, RotateCcw, EyeOff, FileJson, Copy, Tag, Edit, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { suspendVocab, resetVocabProgress, getVocabRawData } from "@/actions/vocab-actions";
import { useTTS } from "@/hooks/use-tts";

interface StickyHeaderProps {
    stability: number; // FSRS Stability (days)
    isReviewPhase?: boolean;
    rank?: number | null;
    className?: string;
    word: string;
    vocabId: number;
}

export function StickyHeader({ stability, isReviewPhase = true, rank, className, word, vocabId }: StickyHeaderProps) {
    const router = useRouter();
    const tts = useTTS();
    const [isPending, startTransition] = useTransition();

    // Dialog States
    const [showResetAlert, setShowResetAlert] = useState(false);
    const [showInspectDialog, setShowInspectDialog] = useState(false);
    const [inspectData, setInspectData] = useState<any>(null);

    // Actions
    const handleCopyId = () => {
        navigator.clipboard.writeText(`#${vocabId}`);
        toast.success("ID copied to clipboard", { description: `Vocab ID: ${vocabId}` });
    };

    const handleInspect = async () => {
        toast.loading("Fetching raw data...");
        try {
            const data = await getVocabRawData(vocabId);
            setInspectData(data);
            setShowInspectDialog(true);
            toast.dismiss();
        } catch (error) {
            toast.error("Failed to fetch data");
        }
    };

    const handleSuspend = async () => {
        startTransition(async () => {
            try {
                await suspendVocab(vocabId);
                toast.success("Card suspended", { description: "It will no longer appear in reviews." });
            } catch (error) {
                toast.error("Failed to suspend card");
            }
        });
    };

    const handleReset = async () => {
        startTransition(async () => {
            try {
                await resetVocabProgress(vocabId);
                toast.success("Progress reset", { description: "Card is now treated as New." });
                setShowResetAlert(false);
            } catch (error) {
                toast.error("Failed to reset progress");
            }
        });
    };

    return (
        <>
            <header className={cn(
                "fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 h-14 transition-colors duration-500",
                "bg-white/80 backdrop-blur-md border-b border-zinc-200", // Light mode
                "dark:bg-zinc-900/60 dark:border-white/15", // Dark mode glassmorphism
                className
            )}>
                {/* Left: Back */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="gap-1 pl-0 text-zinc-400 hover:text-white hover:bg-transparent"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-xs font-medium">List</span>
                </Button>

                {/* Center: Rank Badge + FSRS Status */}
                <div className="flex flex-col items-center gap-1">
                    {/* Rank Badge */}
                    {rank && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold border-0",
                                rank < 3000
                                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                            )}
                        >
                            <span className="mr-1">#</span>{rank} {rank < 3000 ? "CORE" : ""}
                        </Badge>
                    )}

                    {/* FSRS Status */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-500 uppercase">
                            {isReviewPhase ? "待复习" : "学习中"}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                            S:{stability.toFixed(0)}d
                        </span>
                    </div>
                </div>

                {/* Right: Sudo Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            <MoreHorizontal className="w-5 h-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        {/* Content Ops */}
                        <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">Content Ops</DropdownMenuLabel>
                        <DropdownMenuGroup>
                            <DropdownMenuItem disabled>
                                <Edit className="w-4 h-4 mr-2" />
                                <span>Edit Metadata</span>
                                <span className="ml-auto text-xs text-zinc-500">⌘E</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                                <Tag className="w-4 h-4 mr-2" />
                                <span>Manage Tags</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />

                        {/* FSRS Ops */}
                        <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">FSRS Ops</DropdownMenuLabel>
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={handleSuspend} className="text-amber-500 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-900/10">
                                <EyeOff className="w-4 h-4 mr-2" />
                                <span>Suspend Card</span>
                                <span className="ml-auto text-[9px] opacity-50 font-mono">Bury</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowResetAlert(true)} className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10">
                                <RotateCcw className="w-4 h-4 mr-2" />
                                <span>Reset Progress</span>
                                <span className="ml-auto text-[9px] opacity-50 font-mono">Forget</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />

                        {/* Dev Ops */}
                        <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">Dev Ops</DropdownMenuLabel>
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={handleInspect} className="text-indigo-400 focus:text-indigo-500 focus:bg-indigo-50 dark:focus:bg-indigo-900/10">
                                <FileJson className="w-4 h-4 mr-2" />
                                <span>Inspect JSON</span>
                                <span className="ml-auto text-[9px] opacity-50 font-mono">{`{ }`}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCopyId}>
                                <Copy className="w-4 h-4 mr-2" />
                                <span>Copy ID</span>
                                <span className="ml-auto text-[9px] opacity-50 font-mono">#{vocabId}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => tts.play({ text: word })}>
                                <Play className="w-4 h-4 mr-2" />
                                <span>Play Audio</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {/* Reset Confirmation */}
            <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Progress?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will wipe all FSRS memory for "<b>{word}</b>".
                            Stability will reset to 0 and it will appear as a NEW card.
                            <br /><br />
                            <span className="text-rose-500 font-bold">This action cannot be undone.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReset} className="bg-rose-500 hover:bg-rose-600 text-white">
                            Reset Progress
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Inspect JSON Dialog */}
            <Dialog open={showInspectDialog} onOpenChange={setShowInspectDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-indigo-400" />
                            Raw Data Inspector
                            <Badge variant="secondary" className="font-mono">#{vocabId}</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Live data from Postgres for debugging.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto bg-zinc-950 p-4 rounded-md border border-zinc-800">
                        <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                            {JSON.stringify(inspectData, null, 2)}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
