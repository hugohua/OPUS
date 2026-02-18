/**
 * Weaver 场景映射常量
 * 
 * 功能：
 *   将 Weaver Lab 的 6 个高级场景映射到 DB Vocab.scenarios 的 21 个标签
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

/**
 * Weaver 场景 → DB scenarios 标签映射
 * 
 * 规则：每个 Weaver 场景覆盖 3-4 个相关的 DB 标签，
 * 确保场景过滤有足够的候选词覆盖率
 */
// Mapped to DB scenarios (Strictly aligned with lib/generators/etl/vocabulary.ts)
export const WEAVER_SCENARIO_MAP: Record<string, string[]> = {
    // 1. HR & Management (人力与管理)
    hr_group: ['recruitment', 'personnel', 'management'],

    // 2. Finance & Legal (金融与法务)
    finance_group: ['finance', 'investment', 'tax_accounting', 'legal', 'real_estate'],

    // 3. Ops & Production (运营与生产)
    ops_group: ['logistics', 'manufacturing', 'procurement', 'quality_control'],

    // 4. Market & Client (市场与客户)
    market_group: ['marketing', 'sales', 'customer_service', 'negotiation'],

    // 5. Office & Tech (办公与技术)
    office_group: ['office_admin', 'technology', 'general_business'],

    // 6. Travel & Events (差旅与活动)
    travel_group: ['business_travel', 'dining_events'],

    // Generic Fallback (Everything else)
    general: ['general_business']
} as const;

/** 所有 Weaver 场景枚举值 */
export const WEAVER_SCENARIOS = Object.keys(WEAVER_SCENARIO_MAP) as Array<keyof typeof WEAVER_SCENARIO_MAP>;

/** 场景类型 */
export type WeaverScenarioKey = keyof typeof WEAVER_SCENARIO_MAP;

/**
 * 获取 Weaver 场景对应的 DB 标签数组
 * 
 * @param scenario Weaver 场景 key
 * @returns DB scenarios 标签数组，未知场景返回空数组
 */
export function getDbScenariosForWeaver(scenario: string): string[] {
    return WEAVER_SCENARIO_MAP[scenario] ?? [];
}
