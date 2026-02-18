/**
 * Weaver Density 配置常量
 * 
 * 功能：
 *   定义 Weaver Lab 文章生成的篇幅密度选项
 *   统一前端 Selector 和后端 API 校验
 * 
 * 作者: Hugo
 * 日期: 2026-02-16
 */

import { AlignJustify, AlignLeft, FileText, LucideIcon } from "lucide-react";

export const WEAVER_DENSITY_IDS = ["light", "balanced", "dense"] as const;

export interface WeaverDensityConfig {
    id: typeof WEAVER_DENSITY_IDS[number];
    label: string;
    desc: string;
    icon: LucideIcon;
    wordCount: number;
}

export const WEAVER_DENSITY_CONFIGS: WeaverDensityConfig[] = [
    {
        id: "light",
        label: "简短",
        desc: "短小精悍 (150词)",
        icon: AlignLeft,
        wordCount: 150
    },
    {
        id: "balanced",
        label: "适中",
        desc: "均衡详实 (300词)",
        icon: AlignJustify,
        wordCount: 300
    },
    {
        id: "dense",
        label: "详实",
        desc: "深度解析 (500词)",
        icon: FileText,
        wordCount: 500
    },
];

export type WeaverDensityType = WeaverDensityConfig["id"];

/** 获取默认 Density */
export const DEFAULT_WEAVER_DENSITY: WeaverDensityType = "balanced";
