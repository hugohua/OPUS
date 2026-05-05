'use client';

import { ArrowLeft, MoreHorizontal, Play, RotateCcw, FileJson, Copy, Tag, Edit, Share2, CheckCircle2 } from "lucide-react";
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { suspendVocab, resetVocabProgress, getVocabRawData, updateUserVocabTags, saveUserVocabNote } from "@/actions/vocab-actions";
import { useTTS } from "@/hooks/use-tts";
import { ImmersiveHeader } from "@/components/ui/immersive-header";

interface StickyHeaderProps {
    stability: number; // FSRS Stability (days)
    isReviewPhase?: boolean;
    rank?: number | null;
    className?: string;
    word: string;
    vocabId: number;
    initialTags?: string[];
    initialNote?: string;
}

// 标签预设
const PRESET_TAGS = ["精读", "口语弱点", "商务核心", "错题本"];

export function StickyHeader({ stability, isReviewPhase = true, rank, className, word, vocabId, initialTags = [], initialNote = "" }: StickyHeaderProps) {
    const router = useRouter();
    const tts = useTTS();
    const [isPending, startTransition] = useTransition();

    // Dialog States
    const [showResetAlert, setShowResetAlert] = useState(false);
    const [showInspectDialog, setShowInspectDialog] = useState(false);
    const [inspectData, setInspectData] = useState<any>(null);

    // Tags States
    const [showTagsSheet, setShowTagsSheet] = useState(false);
    const [tags, setTags] = useState<string[]>(initialTags);
    const [newTagInput, setNewTagInput] = useState("");
    const [isSavingTags, setIsSavingTags] = useState(false);

    // Note States
    const [showNoteDialog, setShowNoteDialog] = useState(false);
    const [note, setNote] = useState(initialNote);
    const [noteInput, setNoteInput] = useState(initialNote);
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Actions
    const handleCopyId = () => {
        navigator.clipboard.writeText(`#${vocabId}`);
        toast.success("ID 已复制", { description: `词汇 ID: ${vocabId}` });
    };

    const handleInspect = async () => {
        toast.loading("正在拉取原始数据...");
        try {
            const data = await getVocabRawData(vocabId);
            setInspectData(data);
            setShowInspectDialog(true);
            toast.dismiss();
        } catch (error) {
            toast.error("拉取失败");
        }
    };

    const handleSuspend = async () => {
        startTransition(async () => {
            try {
                await suspendVocab(vocabId);
                toast.success("已标为已掌握", { description: "该词将不再作为目标词进入训练队列。" });
            } catch (error) {
                toast.error("设置失败");
            }
        });
    };

    const handleReset = async () => {
        startTransition(async () => {
            try {
                await resetVocabProgress(vocabId);
                toast.success("进度已重置", { description: "该词现已变为新词状态。" });
                setShowResetAlert(false);
            } catch (error) {
                toast.error("重置失败");
            }
        });
    };

    // Feature B Actions
    const handleAddTag = (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        if (tags.length >= 10) {
            toast.error("最多支持 10 个标签");
            return;
        }
        if (trimmed.length > 12) {
            toast.error("标签太长，请勿超过 12 个字符");
            return;
        }
        if (!tags.includes(trimmed)) {
            setTags(prev => [...prev, trimmed]);
        }
        setNewTagInput("");
    };

    const handleRemoveTag = (tag: string) => {
        setTags(prev => prev.filter(t => t !== tag));
    };

    const handleSaveTags = async () => {
        setIsSavingTags(true);
        // Optimistic UX
        setShowTagsSheet(false);
        try {
            await updateUserVocabTags(vocabId, tags);
            toast.success("标签已保存", { description: "筛选变更已同步" });
        } catch (error) {
            toast.error("保存失败，可能有验证违规");
            setTags(initialTags); // Revert
            setShowTagsSheet(true);
        } finally {
            setIsSavingTags(false);
        }
    };

    // Feature A Actions
    const handleSaveNote = async () => {
        setIsSavingNote(true);
        // Optimistic UX
        setNote(noteInput);
        setShowNoteDialog(false);
        try {
            await saveUserVocabNote(vocabId, noteInput);
            toast.success("笔记已保存");
        } catch (error) {
            toast.error("保存失败，笔记最长 200 字");
            setNote(initialNote); // Revert
            setNoteInput(initialNote);
            setShowNoteDialog(true);
        } finally {
            setIsSavingNote(false);
        }
    };

    return (
        <>
            <ImmersiveHeader
                className={className}
                showDefaultBack={true}
                centerContent={
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 tracking-tight">
                            {word}
                        </span>
                        {/* Simple Status Dot */}
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isReviewPhase ? "bg-amber-500" : (stability === 0 ? "bg-slate-300 dark:bg-zinc-600" : "bg-indigo-500")
                        )} />
                    </div>
                }
                rightAction={
                    <DropdownMenu>
                        <DropdownMenuTrigger className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 outline-none">
                            <MoreHorizontal className="w-5 h-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            {/* Content Ops */}
                            <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">内容管理</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                <DropdownMenuItem disabled>
                                    <Edit className="w-4 h-4 mr-2" />
                                    <span>编辑元数据</span>
                                    <span className="ml-auto text-xs text-zinc-500">⌘E</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                    <Tag className="w-4 h-4 mr-2" />
                                    <span>管理标签</span>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />

                            {/* FSRS Ops */}
                            <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">FSRS 操作</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={handleSuspend} className="text-amber-500 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-900/10">
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    <span>标为已掌握</span>
                                    <span className="ml-auto text-[9px] opacity-50 font-mono">熟</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowResetAlert(true)} className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10">
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    <span>重置进度</span>
                                    <span className="ml-auto text-[9px] opacity-50 font-mono">遗忘</span>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />

                            {/* Dev Ops */}
                            <DropdownMenuLabel className="text-[10px] uppercase text-zinc-400 tracking-wider font-bold">开发调试</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={handleInspect} className="text-indigo-400 focus:text-indigo-500 focus:bg-indigo-50 dark:focus:bg-indigo-900/10">
                                    <FileJson className="w-4 h-4 mr-2" />
                                    <span>查看原始数据</span>
                                    <span className="ml-auto text-[9px] opacity-50 font-mono">{`{ }`}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyId}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    <span>复制 ID</span>
                                    <span className="ml-auto text-[9px] opacity-50 font-mono">#{vocabId}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => tts.play({ text: word })}>
                                    <Play className="w-4 h-4 mr-2" />
                                    <span>播放发音</span>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />

            {/* Reset Confirmation */}
            <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认重置进度？</AlertDialogTitle>
                        <AlertDialogDescription>
                            这将清除 "<b>{word}</b>" 的所有 FSRS 记忆数据。
                            稳定性将归零，该词将重新变为新词。
                            <br /><br />
                            <span className="text-rose-500 font-bold">此操作不可撤销。</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReset} className="bg-rose-500 hover:bg-rose-600 text-white">
                            确认重置
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
                            原始数据查看器
                            <Badge variant="secondary" className="font-mono">#{vocabId}</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            来自数据库的实时数据，供调试使用。
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
