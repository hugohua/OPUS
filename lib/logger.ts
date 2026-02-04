import pino from 'pino';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Opus 项目通用日志模块
// 
// 使用方法:
//   import { logger, createLogger, logAIError } from '@/lib/logger';
//   
//   // 1. 直接使用主日志器
//   logger.info('Server started');
//   
//   // 2. 创建模块专用日志器
//   const etlLogger = createLogger('etl');
//   etlLogger.info({ batch: 1 }, 'Processing batch');
//   
//   // 3. AI 服务错误日志 (记录完整 prompt 上下文)
//   logAIError({ error, systemPrompt, userPrompt, rawResponse });
// ============================================================================

// 确保日志目录存在
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志级别：可通过环境变量覆盖
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * 主日志实例 (Pino)
 * 
 * - 开发环境: 彩色美化输出 (pino-pretty) + 文件
 * - 生产环境: 简单 JSON 输出到 stdout
 */

// 根据环境决定配置
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const logger = IS_PRODUCTION
    ? pino({
        level: LOG_LEVEL,
        // 生产环境：简单配置，直接输出 JSON 到 stdout
    })
    : pino({
        level: LOG_LEVEL,
        // 开发环境：使用 transport 支持美化输出和文件日志
        transport: {
            targets: [
                {
                    target: 'pino-pretty',
                    level: LOG_LEVEL,
                    options: {
                        colorize: true,
                        translateTime: 'SYS:HH:MM:ss',
                        ignore: 'pid,hostname',
                    }
                },
                {
                    target: 'pino/file',
                    level: LOG_LEVEL,
                    options: {
                        destination: path.join(LOG_DIR, 'app.log'),
                        mkdir: true,
                    }
                },
                {
                    target: 'pino/file',
                    level: 'error',
                    options: {
                        destination: path.join(LOG_DIR, 'errors.log'),
                        mkdir: true,
                    }
                },
            ]
        }
    });

/**
 * 创建模块专用日志器
 * 
 * @param module - 模块名称，如 'ai', 'etl', 'api'
 * @returns 带模块标识的日志器实例
 * 
 * @example
 * const etlLogger = createLogger('etl');
 * etlLogger.info({ batch: 1, count: 15 }, 'Processing batch');
 * // Output: [20:28:06] INFO (etl): Processing batch { batch: 1, count: 15 }
 */
export function createLogger(module: string) {
    return logger.child({ module });
}

// ============================================================================
// AI 服务专用日志工具
// ============================================================================

/** AI 日志器 */
export const aiLogger = createLogger('ai');

/**
 * 记录 AI 调用错误（包含完整上下文）
 * 
 * 当 AI JSON 解析失败时调用，记录：
 * - System Prompt (截断至 2000 字符)
 * - User Prompt (截断至 5000 字符)
 * - AI 原始响应 (截断至 10000 字符)
 */
export function logAIError(params: {
    error: unknown;
    systemPrompt?: string;
    userPrompt?: string;
    rawResponse?: string;
    model?: string;
    context?: string;
}) {
    const { error, systemPrompt, userPrompt, rawResponse, model, context } = params;

    aiLogger.error({
        context: context || 'AI 调用失败',
        model,
        error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : String(error),
        systemPrompt: systemPrompt ? truncate(systemPrompt, 2000) : undefined,
        userPrompt: userPrompt ? truncate(userPrompt, 5000) : undefined,
        rawResponse: rawResponse ? truncate(rawResponse, 10000) : undefined,
    }, context || 'AI 调用失败');
}

/**
 * 截断过长的字符串
 */
function truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + `... [截断，总长度 ${str.length}]`;
}
