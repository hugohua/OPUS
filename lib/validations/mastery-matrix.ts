import { z } from "zod";

/**
 * MasteryMatrix Schema
 * 
 * 用于校验写入 UserProgress.masteryMatrix 的 JSONB 数据。
 * 遵循架构规则，确保扩展的私人标签和笔记不会导致非结构化滥用。
 */
export const MasteryMatrixSchema = z.object({
    // 核心五维分 (V/A/M/C/X)
    V: z.number().min(0).max(100).optional(),
    A: z.number().min(0).max(100).optional(),
    C: z.number().min(0).max(100).optional(),
    M: z.number().min(0).max(100).optional(),
    X: z.number().min(0).max(100).optional(),

    // 功能 A: 用户自定义记忆口诀，防过长超载 (200字限制)
    userNote: z.string().max(200, { message: "备注最长200字" }).optional(),

    // 功能 B: 用户自定义分类标签，严格防滥用 (最多10个，每个字数截断)
    // 用于按词筛选与后续特殊能力分轨
    userTags: z.array(z.string().max(12, { message: "标签太长(>12字符)" }))
        .max(10, { message: "最多支持10个标签" })
        .optional(),
});

export type MasteryMatrixData = z.infer<typeof MasteryMatrixSchema>;
