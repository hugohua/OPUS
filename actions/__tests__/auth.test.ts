/**
 * Auth Actions 测试
 * 
 * 注意: Auth 逻辑依赖 NextAuth 和数据库，完整测试需要集成环境。
 * 此处验证输入校验 Schema。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Auth Validation Schemas', () => {
    describe('Register Schema', () => {
        it('should accept valid registration data', async () => {
            const { RegisterSchema } = await import('@/lib/validations/auth');

            const validData = {
                email: 'test_hurl@opus.dev',
                password: 'Test123456!',
                name: 'TEST_User',
                inviteCode: 'TEST_CODE'
            };

            const result = RegisterSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid email format', async () => {
            const { RegisterSchema } = await import('@/lib/validations/auth');

            const invalidData = {
                email: 'invalid-email',
                password: 'Test123456!',
                name: 'Test',
                inviteCode: 'CODE'
            };

            const result = RegisterSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject weak password', async () => {
            const { RegisterSchema } = await import('@/lib/validations/auth');

            const weakPasswordData = {
                email: 'test@opus.dev',
                password: '123', // Too short
                name: 'Test',
                inviteCode: 'CODE'
            };

            const result = RegisterSchema.safeParse(weakPasswordData);
            expect(result.success).toBe(false);
        });
    });

    describe('Login Schema', () => {
        it('should accept valid login data', async () => {
            const { LoginSchema } = await import('@/lib/validations/auth');

            const validData = {
                email: 'test_hurl@opus.dev',
                password: 'Test123456!'
            };

            const result = LoginSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject empty password', async () => {
            const { LoginSchema } = await import('@/lib/validations/auth');

            const invalidData = {
                email: 'test@opus.dev',
                password: ''
            };

            const result = LoginSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });
});
