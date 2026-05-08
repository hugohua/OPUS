/**
 * 训练矩阵共享合同
 * 功能：
 *   作为 H5 训练矩阵和 iOS 模拟页的唯一入口配置来源。
 *   这里只定义跨端可复用的入口合同，不承载 FSRS、OMPS 或生成逻辑。
 */

export type TrainingMatrixAccent = "cyan" | "emerald" | "violet" | "amber" | "rose" | "indigo";

export type TrainingMatrixDestination =
    | { kind: "diagnostics"; value: "radar" }
    | { kind: "training"; value: string }
    | { kind: "arena"; value: "part5" | "mission" }
    | { kind: "briefing"; value: "console" | "history" };

export type TrainingMatrixEntry = {
    id: string;
    title: string;
    subtitle: string;
    detail: string;
    tag: string;
    systemImage: string;
    accent: TrainingMatrixAccent;
    destination: TrainingMatrixDestination;
    availability?: "ready" | "empty" | "unavailable";
    count?: number;
    statusLabel?: string;
    /**
     * @deprecated 只保留给旧消费端宽松解码。真实待练状态必须使用
     * buildTrainingMatrixForUser 动态填充的 count/statusLabel。
     */
    queue?: number;
};

export type TrainingMatrixSection = {
    id: string;
    title: string;
    label: string;
    subtitle?: string;
    theme: TrainingMatrixAccent;
    entries: TrainingMatrixEntry[];
};

export type TrainingMatrix = {
    sections: TrainingMatrixSection[];
};

export function buildTrainingMatrix(): TrainingMatrix {
    return {
        sections: [
            {
                id: "diagnostics",
                title: "AI 诊断雷达",
                label: "AI",
                subtitle: "基于 Arena 实战的能力画像",
                theme: "violet",
                entries: [
                    {
                        id: "diagnostic-radar",
                        title: "AI 诊断雷达",
                        subtitle: "能力画像与薄弱点提示",
                        detail: "诊断",
                        tag: "RADAR",
                        systemImage: "activity",
                        accent: "violet",
                        destination: { kind: "diagnostics", value: "radar" },
                    },
                ],
            },
            {
                id: "arena",
                title: "实战演练舱",
                label: "ARC",
                theme: "rose",
                entries: [
                    {
                        id: "arena-blitz",
                        title: "单句闪电战",
                        subtitle: "碎片极速快测",
                        detail: "Part 5",
                        tag: "Part 5",
                        systemImage: "bolt",
                        accent: "violet",
                        destination: { kind: "arena", value: "part5" },
                    },
                    {
                        id: "arena-mission",
                        title: "阅读狙击战",
                        subtitle: "沉浸商务实战",
                        detail: "Part 6/7",
                        tag: "Part 6/7",
                        systemImage: "book",
                        accent: "indigo",
                        destination: { kind: "arena", value: "mission" },
                    },
                ],
            },
            {
                id: "l0",
                title: "基础层",
                label: "L0",
                theme: "amber",
                entries: [
                    {
                        id: "l0-syntax",
                        title: "语法核心",
                        subtitle: "S-V-O 结构训练",
                        detail: "SYNTAX",
                        tag: "SYNTAX",
                        systemImage: "zap",
                        accent: "amber",
                        destination: { kind: "training", value: "SYNTAX" },
                    },
                    {
                        id: "l0-phrase",
                        title: "短语扩展",
                        subtitle: "词组搭配 (1+N)",
                        detail: "PHRASE",
                        tag: "PHRASE",
                        systemImage: "layers",
                        accent: "amber",
                        destination: { kind: "training", value: "PHRASE" },
                    },
                    {
                        id: "l0-blitz",
                        title: "极速闪卡",
                        subtitle: "快速识别训练",
                        detail: "BLITZ",
                        tag: "BLITZ",
                        systemImage: "activity",
                        accent: "amber",
                        destination: { kind: "training", value: "BLITZ" },
                    },
                ],
            },
            {
                id: "l1",
                title: "感知层",
                label: "L1",
                theme: "cyan",
                entries: [
                    {
                        id: "l1-audio",
                        title: "听力训练",
                        subtitle: "听觉反射 (闭眼模式)",
                        detail: "AUDIO",
                        tag: "AUDIO",
                        systemImage: "play",
                        accent: "cyan",
                        destination: { kind: "training", value: "AUDIO" },
                    },
                    {
                        id: "l1-chunking",
                        title: "意群断句",
                        subtitle: "语流切分训练",
                        detail: "CHUNKING",
                        tag: "CHUNKING",
                        systemImage: "split",
                        accent: "cyan",
                        destination: { kind: "training", value: "CHUNKING" },
                    },
                ],
            },
            {
                id: "l2",
                title: "语境层",
                label: "L2",
                theme: "violet",
                entries: [
                    {
                        id: "l2-context",
                        title: "语境填空",
                        subtitle: "逻辑填空 (Part 5/6)",
                        detail: "L2-CONTEXT",
                        tag: "L2-CONTEXT",
                        systemImage: "file-text",
                        accent: "violet",
                        destination: { kind: "training", value: "CONTEXT" },
                    },
                    {
                        id: "l2-nuance",
                        title: "精准辨析",
                        subtitle: "词义辨析 (Part 7)",
                        detail: "L2-NUANCE",
                        tag: "L2-NUANCE",
                        systemImage: "brain",
                        accent: "violet",
                        destination: { kind: "training", value: "NUANCE" },
                    },
                ],
            },
            {
                id: "l3",
                title: "综合层",
                label: "L3",
                theme: "emerald",
                entries: [
                    {
                        id: "l3-weaver",
                        title: "简报中心",
                        subtitle: "场景驱动 · 沉浸阅读",
                        detail: "L3-WEAVER",
                        tag: "L3-WEAVER",
                        systemImage: "book-open",
                        accent: "emerald",
                        destination: { kind: "briefing", value: "console" },
                    },
                    {
                        id: "l3-history",
                        title: "阅读历史",
                        subtitle: "回顾已生成的简报",
                        detail: "L3-HISTORY",
                        tag: "L3-HISTORY",
                        systemImage: "history",
                        accent: "emerald",
                        destination: { kind: "briefing", value: "history" },
                    },
                ],
            },
        ],
    };
}
