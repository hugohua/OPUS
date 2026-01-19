import { z } from 'zod';
import {
    DefinitionsSchema,
    CollocationSchema,
    WordFamilySchema
} from '@/lib/validations/ai';

// ============================================================================
// 1. Re-export Zod Schemas (Single Source of Truth)
// ============================================================================
// Use schemas from AI validation to ensure DB data matches AI output
export const DbDefinitionsSchema = DefinitionsSchema;
export const DbCollocationListSchema = z.array(CollocationSchema);
export const DbWordFamilySchema = WordFamilySchema;

// ============================================================================
// 2. Derive TypeScript Types
// ============================================================================
export type DbDefinitions = z.infer<typeof DbDefinitionsSchema>;
export type DbCollocation = z.infer<typeof CollocationSchema>; // Single item
export type DbCollocationList = z.infer<typeof DbCollocationListSchema>; // List
export type DbWordFamily = z.infer<typeof DbWordFamilySchema>;

// ============================================================================
// 3. Runtime Validation Helpers (Safe Parse)
// ============================================================================

/**
 * Validates 'definitions' JSON field from DB
 */
export function parseDbDefinitions(json: unknown): DbDefinitions | null {
    if (!json) return null;
    const result = DbDefinitionsSchema.safeParse(json);
    if (!result.success) {
        console.error('❌ Invalid DB Definitions:', result.error);
        return null;
    }
    return result.data;
}

/**
 * Validates 'collocations' JSON field from DB
 */
export function parseDbCollocations(json: unknown): DbCollocationList {
    if (!json) return [];
    // Handle case where json might be array or wrapped
    const result = DbCollocationListSchema.safeParse(json);
    if (!result.success) {
        console.error('❌ Invalid DB Collocations:', result.error);
        return [];
    }
    return result.data;
}

/**
 * Validates 'word_family' JSON field from DB
 */
export function parseDbWordFamily(json: unknown): DbWordFamily | null {
    if (!json) return null;
    const result = DbWordFamilySchema.safeParse(json);
    if (!result.success) {
        console.error('❌ Invalid DB WordFamily:', result.error);
        return null;
    }
    return result.data;
}
