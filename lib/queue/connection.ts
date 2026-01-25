/**
 * Redis 连接模块
 * 功能：
 *   提供 BullMQ 所需的 Redis 连接单例
 * 配置：
 *   使用 .env 中的 REDIS_URL
 */
import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

export const redis =
    globalForRedis.redis ??
    new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null, // BullMQ 要求
        enableReadyCheck: false,
    });

if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis;
}
