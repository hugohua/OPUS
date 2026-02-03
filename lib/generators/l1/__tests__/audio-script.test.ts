
import { describe, it, expect } from 'vitest';
import { getL1AudioScriptPrompt } from '../audio-script';
import { BriefingPayloadSchema } from '@/lib/validations/briefing';

describe('L1 Audio Script Generator', () => {

    // 1. 测试四阶段矩阵触发逻辑
    it('Should generate Stage 1 (Carrier Phrase) for low stability', () => {
        const input = {
            word: 'accept',
            stability: 0.5, // < 3
            difficulty: 5
        };
        const prompt = getL1AudioScriptPrompt([input]);
        // Mode logic is injected into USER prompt via contextStr
        expect(prompt.user).toContain('MODE: Carrier Phrase');
    });

    it('Should generate Stage 2 (Q&A) for medium stability', () => {
        const input = {
            word: 'accept',
            stability: 5.0, // 3 <= s < 15
            difficulty: 5
        };
        const prompt = getL1AudioScriptPrompt([input]);
        expect(prompt.user).toContain('MODE: Instant Logic');
    });

    it('Should generate Stage 3 (Dialogue) for high stability', () => {
        const input = {
            word: 'accept',
            stability: 16.0, // >= 15
            difficulty: 5
        };
        const prompt = getL1AudioScriptPrompt([input]);
        expect(prompt.user).toContain('MODE: Dialogue');
    });

    it('Should generate Stage 4 (Minimal Pair) for high difficulty', () => {
        const input = {
            word: 'accept',
            stability: 5.0,
            difficulty: 8.0, // > 7
            confusion_audio: ['except', 'access']
        };
        const prompt = getL1AudioScriptPrompt([input]);
        expect(prompt.user).toContain('MODE: Auditory Discrimination');
        expect(prompt.user).toContain('Confusions: [except, access]');
    });

    // 2. 验证输出结构 (Mock LLM response parsing if applicable, 
    // but here we test the prompt construction primarily)

});
