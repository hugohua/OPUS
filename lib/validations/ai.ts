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

// 新增 Priority 枚举
export const PriorityEnum = z.enum(["CORE", "SUPPORT", "NOISE"]);

// 新增 Word Family 结构
export const WordFamilySchema = z.object({
    n: z.string().nullable(),
    v: z.string().nullable(),
    adj: z.string().nullable(),
    adv: z.string().nullable(),
});

// AI 输出单项
const BaseVocabularyResultItemSchema = z.object({
    word: z.string(),
    definition_cn: z.string().max(10),
    definitions: DefinitionsSchema,
    priority: PriorityEnum,
    scenarios: z.array(ScenariosEnum),
    collocations: z.array(CollocationSchema),
    word_family: WordFamilySchema.nullable().optional(),
    confusing_words: z.array(z.string()),
    synonyms: z.array(z.string()),
});

// 使用 transform 自动推导 is_toeic_core，保持向下兼容
export const VocabularyResultItemSchema = BaseVocabularyResultItemSchema.transform((data) => ({
    ...data,
    is_toeic_core: data.priority === "CORE"
}));

// AI 输出完整结构
export const VocabularyResultSchema = z.object({
    items: z.array(VocabularyResultItemSchema)
});
