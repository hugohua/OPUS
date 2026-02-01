import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// 在开发模式下，每次热更新后都需要重新创建 PrismaClient 实例
// 以确保新的模型定义 (如 SmartContent) 被正确加载
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
export const db = prisma;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

