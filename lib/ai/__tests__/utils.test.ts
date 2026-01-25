import { describe, it, expect } from 'vitest';
import { cleanMarkdown, repairJson, recoverTruncatedJson, safeParse } from '../utils';
import { z } from 'zod';

describe('AI Utils', () => {
    describe('cleanMarkdown', () => {
        it('should remove ```json and ```', () => {
            const input = '```json\n{"a":1}\n```';
            expect(cleanMarkdown(input)).toBe('{"a":1}');
        });

        it('should remove ``` without language', () => {
            const input = '```\n{"a":1}\n```';
            expect(cleanMarkdown(input)).toBe('{"a":1}');
        });
    });

    describe('repairJson', () => {
        it('should remove trailing commas in objects', () => {
            const input = '{"a": 1, }';
            expect(repairJson(input)).toBe('{"a": 1}');
        });

        it('should remove trailing commas in arrays', () => {
            const input = '[1, 2, ]';
            expect(repairJson(input)).toBe('[1, 2]');
        });

        it('should fix continuous commas', () => {
            const input = '[1,, 2]';
            expect(repairJson(input)).toBe('[1, 2]');
        });

        it('should handle complex nesting', () => {
            const input = '{"a": [1, ], "b": { "c": 2, }, }';
            expect(repairJson(input)).toBe('{"a": [1], "b": { "c": 2}}');
        });
    });

    describe('recoverTruncatedJson', () => {
        it('should recover simple item array truncated', () => {
            const input = '{"items": [{"id":1}, {"id":2}, {"id":3';
            const result = recoverTruncatedJson(input);
            expect(result).not.toBeNull();
            expect(result?.recovered).toBe('{"items": [{"id":1}, {"id":2}]}');
            expect(result?.itemsDropped).toBe(1);
        });

        it('should return null if no items start found', () => {
            const input = '{"data": []}'; // no "items" or "drills"
            expect(recoverTruncatedJson(input)).toBeNull();
        });

        it('should handle "drills" key as well', () => {
            const input = '{"drills": [{"a":1}, {"a":2';
            const result = recoverTruncatedJson(input);
            expect(result?.recovered).toBe('{"drills": [{"a":1}]}');
        });

        it('should return null if valid internal brace logic is broken', () => {
            // This tests the loop logic: valid items must be properly closed
            const input = '{"items": [{"a":';
            // Only partial first item
            const result = recoverTruncatedJson(input);
            expect(result).toBeNull();
        });

        it('should recover with nested objects in items', () => {
            const input = '{"items": [{"meta": {"a": 1}}, {"meta": {"a": 2}}, {"meta"';
            const result = recoverTruncatedJson(input);
            expect(JSON.parse(result!.recovered)).toEqual({
                items: [
                    { meta: { a: 1 } },
                    { meta: { a: 2 } }
                ]
            });
        });
    });

    describe('safeParse', () => {
        const schema = z.object({
            items: z.array(z.object({ id: z.number() }))
        });

        it('should parse valid json', () => {
            const input = '{"items": [{"id": 1}]}';
            expect(safeParse(input, schema)).toEqual({ items: [{ id: 1 }] });
        });

        it('should parse valid json array and wrap it', () => {
            const input = '[{"id": 1}]';
            expect(safeParse(input, schema)).toEqual({ items: [{ id: 1 }] });
        });

        it('should parse valid json with trailing commas', () => {
            const input = '{"items": [{"id": 1, }, ], }';
            expect(safeParse(input, schema)).toEqual({ items: [{ id: 1 }] });
        });

        it('should recover and parse truncated json', () => {
            const input = '{"items": [{"id": 1}, {"id": 2';
            expect(safeParse(input, schema)).toEqual({ items: [{ id: 1 }] });
        });

        it('should throw error if recovery fails', () => {
            const input = '{"items": [{"id": '; // Completely broken
            expect(() => safeParse(input, schema)).toThrow();
        });
    });
});
