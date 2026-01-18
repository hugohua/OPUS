import { z } from 'zod';

// 商务场景枚举（业务规则）
export const ScenariosEnum = z.enum([
    "recruitment", "personnel", "management", "office_admin", "finance",
    "investment", "tax_accounting", "legal", "logistics", "manufacturing",
    "procurement", "quality_control", "marketing", "sales", "customer_service",
    "negotiation", "business_travel", "dining_events", "technology",
    "real_estate", "general_business"
]);

// 搭配结构
export const CollocationSchema = z.object({
    text: z.string(),
    trans: z.string(),
    origin: z.enum(['abceed', 'ai']),
});

// 释义结构
export const DefinitionsSchema = z.object({
    business_cn: z.string().nullable(),
    general_cn: z.string(),
});

// AI 输入结构
export const VocabularyInputSchema = z.object({
    word: z.string(),
    def_en: z.string(),
    def_jp: z.string().nullable().optional(),
    col_jp: z.array(z.any()).optional(),
});

// AI 输出单项
export const VocabularyResultItemSchema = z.object({
    word: z.string(),
    definition_cn: z.string().max(10),
    definitions: DefinitionsSchema,
    is_toeic_core: z.boolean(),
    scenarios: z.array(ScenariosEnum),
    collocations: z.array(CollocationSchema),
});

// AI 输出完整结构
export const VocabularyResultSchema = z.object({
    items: z.array(VocabularyResultItemSchema)
});
