import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'node', // Default to node
        globals: true,
        include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['lib/validations/**', 'actions/**'],
        },
        alias: {
            "next/server": path.resolve(__dirname, "node_modules/next/server.js")
        },
        setupFiles: ["tests/setup.ts"]
    },
});
