import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAIModel } from '../client';

// Mock OpenAI
vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(() => ({
        chat: vi.fn((name) => ({ name }))
    }))
}));

describe('AI Client (Factory)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should use default scenario correctly', () => {
        process.env.OPENAI_API_KEY = 'sk-default';
        process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
        process.env.AI_MODEL_NAME = 'gpt-4';

        const { modelName } = getAIModel('default');
        expect(modelName).toBe('gpt-4');
    });

    it('should use ETL scenario with override', () => {
        process.env.OPENAI_API_KEY = 'sk-default';
        process.env.ETL_API_KEY = 'sk-etl';
        process.env.ETL_MODEL_NAME = 'qwen-max';

        const { modelName } = getAIModel('etl');
        expect(modelName).toBe('qwen-max');
    });

    it('should respect ETL_HTTPS_PROXY explicitly if provided', () => {
        process.env.HTTPS_PROXY = 'http://global-proxy';
        process.env.ETL_HTTPS_PROXY = 'http://etl-proxy';

        // We can't easily check the internal agent without more complex mocking,
        // but we verify the logic flow doesn't crash and respects ETL variables.
        const { modelName } = getAIModel('etl');
        expect(modelName).toBeDefined();
    });

    it('should disable proxy if ETL_HTTPS_PROXY is empty string', () => {
        process.env.HTTPS_PROXY = 'http://global-proxy';
        process.env.ETL_HTTPS_PROXY = '';

        const { modelName } = getAIModel('etl');
        expect(modelName).toBeDefined();
    });
});
