/**
 * Weaver 场景 UI 配置
 * 
 * 功能：
 *   Config-Driven 的场景卡片元数据，UI 组件只负责渲染
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

export interface WeaverScenarioConfig {
    /** 场景标识符 */
    key: string;
    /** 显示名称 */
    label: string;
    /** 场景描述 */
    description: string;
    /** 图标 (lucide-react 名称) */
    icon: string;
    /** 卡片主色调 (Tailwind class) */
    colorClass: string;
}

/**
 * Weaver 场景卡片配置
 * 
 * 排列顺序 = UI 展示顺序
 */
export const WEAVER_SCENARIO_CONFIGS: WeaverScenarioConfig[] = [
    {
        key: "finance",
        label: "财务金融",
        description: "财务管理 · 审计 · 投融资",
        icon: "TrendingUp",
        colorClass: "text-emerald-500",
    },
    {
        key: "hr",
        label: "人力资源",
        description: "招聘 · 绩效 · 团队管理",
        icon: "Users",
        colorClass: "text-blue-500",
    },
    {
        key: "marketing",
        label: "市场营销",
        description: "营销策略 · 品牌 · 用户增长",
        icon: "Megaphone",
        colorClass: "text-orange-500",
    },
    {
        key: "operations",
        label: "运营管理",
        description: "供应链 · 制造 · 质量控制",
        icon: "Settings",
        colorClass: "text-slate-500",
    },
    {
        key: "office",
        label: "行政差旅",
        description: "行政 · 商务差旅 · 日常办公",
        icon: "Building2",
        colorClass: "text-violet-500",
    },
    {
        key: "tech",
        label: "技术法务",
        description: "技术创新 · 合同法务 · 谈判",
        icon: "Code",
        colorClass: "text-indigo-500",
    },
];

/**
 * Density (文章篇幅) 配置
 */
export interface DensityConfig {
    key: string;
    label: string;
    wordCount: string;
}

export const DENSITY_CONFIGS: DensityConfig[] = [
    { key: "light", label: "简短", wordCount: "~150" },
    { key: "balanced", label: "适中", wordCount: "~250" },
    { key: "dense", label: "详实", wordCount: "~400" },
];
