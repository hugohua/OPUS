import { getVocabDetail } from "@/actions/get-vocab-detail";
import { StickyHeader } from "@/components/vocabulary/detail/StickyHeader";
import { VocabHero } from "@/components/vocabulary/detail/VocabHero";
import { CommonChunks } from "@/components/vocabulary/detail/CommonChunks";
import { ContextSnapshot } from "@/components/vocabulary/detail/ContextSnapshot";
import { WeaverLab } from "@/components/vocabulary/detail/WeaverLab";
import { GestureHint } from "@/components/vocabulary/detail/GestureHint";
import { redirect } from "next/navigation";

interface WordDetailPageProps {
    params: Promise<{
        word: string;
    }>;
}

export default async function WordDetailPage(props: WordDetailPageProps) {
    const params = await props.params;
    // Decode URI component to handle spaces or special characters
    const identifier = decodeURIComponent(params.word);

    // We can now pass string identifier directly to getVocabDetail
    const data = await getVocabDetail(identifier);

    if (!data || !data.vocab) {
        redirect("/dashboard/vocabulary");
    }

    const { vocab, progress } = data;

    // Default values if no progress
    const stability = progress?.stability ?? 0;
    // Simple logic: if stability > 0, we can consider it Review Phase or at least Learning
    const isReviewPhase = stability > 0;

    return (
        <div className="relative h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased flex flex-col overflow-hidden selection:bg-indigo-500/30">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-emerald-500/5 dark:bg-emerald-500/5 blur-[100px] pointer-events-none z-0"></div>

            {/* Header */}
            <StickyHeader
                stability={stability}
                isReviewPhase={isReviewPhase}
                rank={vocab.abceed_rank}
                word={vocab.word}
                vocabId={vocab.id}
            />

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 pb-32 relative z-10 scroll-smooth">

                {/* Hero */}
                <VocabHero
                    word={vocab.word}
                    phonetic={vocab.phoneticUs || vocab.phoneticUk}
                    definition={vocab.definition_cn} // Using Chinese definition as per request logic
                    definitions={vocab.definitions}
                    rank={vocab.abceed_rank}
                    derivatives={vocab.word_family}
                    synonyms={vocab.synonyms}
                />

                {/* L0: Common Chunks */}
                <CommonChunks
                    collocations={(vocab.collocations as any) || []}
                    mainWord={vocab.word}
                />

                {/* L2: Context */}
                <ContextSnapshot
                    vocabId={vocab.id}
                    mainWord={vocab.word}
                    definition={vocab.definition_cn || undefined}
                />

                {/* L3: Weaver Lab */}
                <WeaverLab
                    targetWord={vocab.word}
                    vocabId={vocab.id}
                />

            </main>

            {/* Gesture Hint */}
            <GestureHint />

        </div>
    );
}
