/**
 * 归一化 CONTEXT drill 的 LLM 输出
 * 
 * LLM 可能返回两种格式：
 * 1. 标准 BriefingPayload: segments 含 {type:"text"} + {type:"interaction", task:{...}}
 * 2. 扁平格式: segments 含 {sentence, options, answer, socraticHint}（无 type/task wrapper）
 * 
 * 本函数将格式 2 转换为格式 1，确保数据结构一致。
 * 如果已是标准格式，原样返回。
 */
export function normalizeContextDrill(drill: any): any {
    if (!drill?.segments || !Array.isArray(drill.segments)) return drill;

    // 检测是否已是标准格式 (有 type 字段)
    const hasTypedSegments = drill.segments.some((s: any) => s.type === 'text' || s.type === 'interaction');
    if (hasTypedSegments) return drill;

    // 扁平格式: 每个 segment 含 sentence/options/answer
    const normalizedSegments: any[] = [];
    for (const seg of drill.segments) {
        if (seg.sentence && seg.options) {
            // 转换为标准双 segment 结构
            normalizedSegments.push({
                type: 'text',
                content_markdown: seg.sentence,
                translation_cn: seg.translation_cn || ''
            });
            normalizedSegments.push({
                type: 'interaction',
                dimension: 'X',
                task: {
                    style: 'slot_machine',
                    question_markdown: seg.sentence,
                    options: seg.options,
                    answer_key: seg.answer || seg.answer_key || '',
                    explanation_markdown: seg.explanation_markdown || seg.explanation || '',
                    socraticHint: seg.socraticHint || ''
                }
            });
        }
    }

    if (normalizedSegments.length > 0) {
        return { ...drill, segments: normalizedSegments };
    }

    return drill;
}
