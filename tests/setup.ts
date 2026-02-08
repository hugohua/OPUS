import { vi } from 'vitest';
console.log("Loaded tests/setup.ts");

// Mock next/server for next-auth
vi.mock('next/server', () => {
    console.log("Mocking next/server");
    return {
        NextResponse: {
            json: (body: any, init?: any) => ({ body, init }),
            redirect: (url: string) => ({ url })
        }
    };
});

// Mock next-auth to avoid loading lib/env.js if possible
vi.mock('next-auth', () => ({
    default: vi.fn(() => ({
        auth: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
        signIn: vi.fn(),
        signOut: vi.fn(),
    })),
    NextAuth: vi.fn(() => ({
        auth: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
        signIn: vi.fn(),
        signOut: vi.fn(),
    }))
}));
