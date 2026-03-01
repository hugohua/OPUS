import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ImmersiveHeader } from "@/components/ui/immersive-header";
import { AiDiagnosticStream } from "@/components/profile/mistakes/ai-diagnostic-view";
import { MistakeActionFooter } from "@/components/profile/mistakes/mistake-action-footer";

export const dynamic = "force-dynamic";

export default async function MistakeDetailPage(
    props: {
        params: Promise<{ id: string }>;
        searchParams: Promise<{ fails?: string }>;
    }
) {
    const params = await props.params;
    const searchParams = await props.searchParams;

    const session = await auth();
    if (!session?.user?.id) return notFound();

    const mistakeId = params.id;
    const fails = searchParams.fails || "1";

    const log = await prisma.userMistakeBook.findUnique({
        where: { id: mistakeId, userId: session.user.id }
    });

    if (!log) return notFound();

    // 提取分类
    let categoryName = "VOCABULARY";
    let categoryColor = "bg-white border-slate-200 text-slate-500";
    if (log.questionType === 'GRAMMAR' || !!log.grammarNodeId) {
        categoryName = "GRAMMAR";
    } else if (log.questionType === 'COLLOCATION') {
        categoryName = "COLLOCATION";
    }

    // 处理题目文本，还原挖空
    const snapshot = log.snapshot as unknown as import("@/types/briefing").BriefingPayload;
    let textContent = snapshot.passage_markdown || "";
    if (!textContent) {
        const interaction = snapshot.segments?.find((s) => s.type === 'interaction') as import("@/types/briefing").InteractionSegment | undefined;
        if (interaction && interaction.task && 'question_markdown' in interaction.task) {
            textContent = interaction.task.question_markdown;
        } else {
            const txtSeg = snapshot.segments?.find((s) => s.type === 'text') as import("@/types/briefing").TextSegment | undefined;
            textContent = txtSeg?.content_markdown || "Context lost";
        }
    }
    const highlightedText = textContent.replace(
        /_{2,}/g,
        `<span class="inline-block w-10 border-b-2 border-slate-300 mx-1 align-baseline relative top-[-4px]"></span>`
    );

    return (
        <div className="relative w-full min-h-screen max-w-md mx-auto bg-white text-slate-900 font-sans antialiased flex flex-col shadow-2xl sm:border-x sm:border-slate-200 overflow-hidden selection:bg-indigo-100 pb-24">

            <ImmersiveHeader
                className="bg-white/90 border-b border-slate-100"
                leftAction={
                    <Link href="/dashboard/profile/mistakes" className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95">
                        <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
                    </Link>
                }
                centerContent={
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">错题报告</span>
                        <h1 className="text-sm font-bold text-slate-900 font-mono tracking-tight">ERR-{snapshot?.meta?.questionSeedId?.slice(-6) || log.id.slice(-6)}</h1>
                    </div>
                }
                rightAction={
                    <div className="px-2 py-1 flex-shrink-0 rounded bg-rose-50 border border-rose-200 flex items-center gap-1.5 cursor-help">
                        {log.status === 'ACTIVE' ? (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-[9px] font-mono font-bold text-rose-600 uppercase">待解决</span>
                            </>
                        ) : (
                            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">已解决</span>
                        )}
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto">
                {/* SSR 静态内容（零等待渲染） */}
                <section className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-mono font-bold text-slate-500">
                            PART {log.part}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${categoryColor} text-[9px] font-mono font-bold`}>
                            {categoryName}
                        </span>
                        {parseInt(fails) >= 3 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-[9px] font-mono font-bold text-rose-500">
                                错误 {fails} 次
                            </span>
                        )}
                    </div>

                    <p className="text-[16px] text-slate-800 font-serif leading-relaxed mb-5" dangerouslySetInnerHTML={{ __html: highlightedText }} />

                    <div className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                                <X className="w-3.5 h-3.5 text-rose-500" strokeWidth={3} />
                            </div>
                            <div>
                                <span className="text-[14px] font-sans text-rose-600 line-through decoration-rose-300 font-medium">
                                    {log.userWrongAnswer}
                                </span>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                    你的选择 ({log.createdAt.toLocaleString('zh-CN', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                                </p>
                            </div>
                        </div>
                        <div className="w-full h-px bg-slate-100 my-1"></div>
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                            </div>
                            <div>
                                <span className="text-[14px] font-sans text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-100">
                                    {log.correctAnswer}
                                </span>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">正确答案</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI 诊断分析（Client Component 自管理流式加载与错误降级） */}
                <AiDiagnosticStream mistakeId={mistakeId} />
            </main>

            <MistakeActionFooter
                mistakeId={mistakeId}
                grammarNodeId={log.grammarNodeId}
                questionType={log.questionType}
                part={log.part}
            />
        </div>
    );
}

