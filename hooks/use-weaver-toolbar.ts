import { useState, useCallback } from "react";
import { useTTS } from "@/hooks/use-tts";
import { useTextSelection } from "@/hooks/use-text-selection";
import { toast } from "sonner";
import { DEFAULT_TTS_VOICE } from "@/config/audio";

interface UseWeaverToolbarProps {
    scenario: string;
    parsedContent: { titleText: string, bodyParts: string[] } | null;
    tts: ReturnType<typeof useTTS>;
    selection: ReturnType<typeof useTextSelection>['selection'];
    clearSelection: () => void;
    setSelection: (s: any) => void;
}

export function useWeaverToolbar({
    scenario,
    parsedContent,
    tts,
    selection,
    clearSelection,
    setSelection
}: UseWeaverToolbarProps) {
    const [wandTarget, setWandTarget] = useState<string | null>(null);
    const [wandType, setWandType] = useState<"word" | "sentence">("word");
    const [wandContext, setWandContext] = useState<string>("");
    const [isWandOpen, setIsWandOpen] = useState(false);

    // ✅ B5: 浮出工具栏回调
    const handleAnalyze = useCallback((text: string, type: "word" | "sentence") => {
        const cleanText = text.replace(/[^a-zA-Z\s,.'"-]/g, "").trim();

        setWandTarget(cleanText);
        setWandType(type);

        // If it's a word, use the captured context (from click) or fallback to scenario
        if (type === "word") {
            if (!wandContext) {
                setWandContext(scenario);
            }
        }

        setIsWandOpen(true);
        clearSelection();
    }, [clearSelection, wandContext, scenario]);

    const handlePlay = useCallback((text: string) => {
        tts.play({ text, voice: DEFAULT_TTS_VOICE, language: 'en-US', speed: 0.9 });
    }, [tts]);

    const handleCopy = useCallback(() => {
        // 复制由 FloatingToolbar 内部处理
    }, []);

    const handleExpandToSentence = useCallback((word: string) => {
        // word 是清洗后的纯字母（如 "companys"），需要用原始文本搜索（如 "company's"）
        const originalWord = selection?.domNode?.textContent?.trim() || word;
        console.log("[WeaverToolbar] Expanding to sentence for:", { cleaned: word, original: originalWord });

        if (!parsedContent) {
            console.warn("[WeaverToolbar] No parsedContent available");
            return;
        }

        for (const para of parsedContent.bodyParts) {
            if (para.includes(originalWord)) {
                // 按句号/问号/感叹号分句
                const sentences = para.match(/[^.!?]+[.!?]+[\])'"]*|[^.!?]+$/g) || [];
                const targetSentence = sentences.find(s => s.includes(originalWord));
                if (targetSentence) {
                    console.log("[WeaverToolbar] Found target sentence:", targetSentence.trim());
                    setSelection((prev: any) => prev ? { ...prev, text: targetSentence.trim(), type: "sentence" } : null);
                    return;
                }
            }
        }
        console.warn("[WeaverToolbar] No matching sentence found for:", originalWord);
    }, [parsedContent, setSelection, selection]);

    return {
        wandTarget,
        wandType,
        wandContext,
        setWandContext,
        isWandOpen,
        setIsWandOpen,
        handleAnalyze,
        handlePlay,
        handleCopy,
        handleExpandToSentence
    };
}
