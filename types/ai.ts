import { z } from 'zod';
import {
    VocabularyInputSchema,
    VocabularyResultSchema,
    VocabularyResultItemSchema,
} from '@/lib/validations/ai';

// 从 Zod 推导类型
export type VocabularyInput = z.infer<typeof VocabularyInputSchema>;
export type VocabularyResult = z.infer<typeof VocabularyResultSchema>;
export type VocabularyResultItem = z.infer<typeof VocabularyResultItemSchema>;
