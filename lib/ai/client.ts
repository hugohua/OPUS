import { createOpenAI } from '@ai-sdk/openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch, { RequestInit as NodeFetchRequestInit } from 'node-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('ai-client');

export type AIScenario = 'etl' | 'default';

/**
 * 创建带代理的 fetch 函数
 * @param specificProxyUrl - 指定的代理 URL，如果有值则优先使用，否则尝试读取 HTTPS_PROXY
 */
function createProxyFetch(specificProxyUrl?: string): typeof fetch | undefined {
    // 优先级: 参数指定 > 环境变量 HTTPS_PROXY
    // 注意: 如果 specificProxyUrl 显式传空字符串 ""，则表示禁用代理
    const proxyUrl = specificProxyUrl !== undefined ? specificProxyUrl : process.env.HTTPS_PROXY;

    if (!proxyUrl) {
        return undefined;
    }

    log.debug({ proxy: proxyUrl }, 'Proxy enabled for AI requests');
    const agent = new HttpsProxyAgent(proxyUrl);

    const proxyFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();

        const nodeFetchInit: NodeFetchRequestInit = {
            method: init?.method,
            headers: init?.headers as NodeFetchRequestInit['headers'],
            body: init?.body as NodeFetchRequestInit['body'],
            agent,
        };

        const response = await nodeFetch(url, nodeFetchInit);
        return response as unknown as Response;
    };

    return proxyFetch;
}

/**
 * 获取指定场景的 AI 模型实例
 * 
 * 策略:
 * - 'etl': 严格读取 ETL_* 配置 (NO LEGACY FALLBACK)
 * - 'default': 读取 OPENAI_* 配置 (核心/默认通道)
 */
export function getAIModel(scenario: AIScenario = 'default') {
    let apiKey = process.env.OPENAI_API_KEY;
    let baseURL = process.env.OPENAI_BASE_URL;
    let modelName = process.env.AI_MODEL_NAME || 'qwen-plus';
    let proxyUrl: string | undefined = undefined; // undefined = use auto detection (HTTPS_PROXY)

    // ETL 场景专用配置
    if (scenario === 'etl') {
        const etlKey = process.env.ETL_API_KEY;
        const etlBase = process.env.ETL_BASE_URL;
        const etlModel = process.env.ETL_MODEL_NAME;
        const etlProxy = process.env.ETL_HTTPS_PROXY;

        if (etlKey) apiKey = etlKey;
        if (etlBase) baseURL = etlBase;
        if (etlModel) modelName = etlModel;

        // 显式处理代理：
        // 1. 如果 ETL_HTTPS_PROXY 有值 (如 "http://..."), 则强制使用该代理
        // 2. 如果 ETL_HTTPS_PROXY 为空字符串 "", 则 specificProxyUrl 变成 "" -> createProxyFetch 会识别并禁用代理
        // 3. 如果 ETL_HTTPS_PROXY 未定义 (undefined), 则 specificProxyUrl 为 undefined -> createProxyFetch 回退到 HTTPS_PROXY
        if (etlProxy !== undefined) {
            proxyUrl = etlProxy;
        }

        log.debug({
            scenario,
            model: modelName,
            customProxy: etlProxy !== undefined
        }, 'AI Factory: Configured for ETL');
    } else {
        log.debug({ scenario, model: modelName }, 'AI Factory: Configured for Default/Core');
    }

    // 2. Create OpenAI Provider with Proxy
    const proxyFetch = createProxyFetch(proxyUrl);

    // 3. Instantiate
    const openai = createOpenAI({
        apiKey,
        baseURL,
        ...(proxyFetch && { fetch: proxyFetch }),
    });

    return {
        model: openai.chat(modelName),
        modelName
    };
}
