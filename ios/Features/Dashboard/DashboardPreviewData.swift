import Foundation

enum DashboardPreviewData {
    static let defaultDiagnosticsSummary = DashboardDiagnosticsSummary(
        statusTitle: "调试环境就绪",
        detail: "Local API 与原生壳层已连接，可随时切换到诊断面板。"
    )

    static let defaultHomeState = DashboardHomeState(
        greetingName: "Hugo",
        greetingLine: "继续保持进步。",
        moduleTitle: "首页",
        telemetryScoreText: "94% R",
        metrics: [
            DashboardMetric(id: "mastered", title: "已掌握", value: "0", footnote: "掌握稳定"),
            DashboardMetric(id: "learning", title: "学习中", value: "61", footnote: "保持输入"),
            DashboardMetric(id: "review", title: "待复习", value: "60", footnote: "需要回收")
        ],
        primaryTask: DashboardPrimaryTask(
            title: "每日闪电战",
            subtitle: "20 词 · 混合模式",
            detail: "待复习",
            ctaTitle: "进入训练",
            accent: .violet,
            destination: .training(mode: "DAILY_BLITZ")
        ),
        trainingCards: [
            DashboardFeatureCard(
                id: "sentence-blitz",
                title: "单句闪电战",
                subtitle: "碎片极速快测",
                detail: "Part 5",
                systemImage: "bolt",
                badgeText: "Part 5",
                accent: .violet,
                destination: .arena(path: "part5")
            ),
            DashboardFeatureCard(
                id: "reading-sniper",
                title: "阅读狙击战",
                subtitle: "沉浸商务实战",
                detail: "Part 6",
                systemImage: "book",
                badgeText: "Part 6",
                accent: .indigo,
                destination: .arena(path: "mission")
            ),
            DashboardFeatureCard(
                id: "phrase-deck",
                title: "短语卡组",
                subtitle: "商务搭配",
                detail: "视觉",
                systemImage: "square.stack.3d.up",
                badgeText: "视觉",
                accent: .indigo,
                destination: .training(mode: "PHRASE")
            ),
            DashboardFeatureCard(
                id: "drive-mode",
                title: "听力驾驶",
                subtitle: "被动听力",
                detail: "听力",
                systemImage: "car",
                badgeText: "听力",
                accent: .amber,
                destination: .audio
            ),
            DashboardFeatureCard(
                id: "review-stack",
                title: "复习卡组",
                subtitle: "滑动复习",
                detail: "记忆",
                systemImage: "checklist.checked",
                badgeText: "记忆",
                accent: .emerald,
                destination: .reviewCards
            )
        ],
        skillCards: [
            DashboardFeatureCard(
                id: "speed-run",
                title: "极速挑战",
                subtitle: "视觉 & 语义 (L0)",
                detail: "L0",
                systemImage: "bolt.badge.a",
                badgeText: nil,
                accent: .emerald,
                destination: .training(mode: "L0_MIXED")
            ),
            DashboardFeatureCard(
                id: "listening-drill",
                title: "听力训练",
                subtitle: "听力 & 逻辑 (L1)",
                detail: "L1",
                systemImage: "speaker.wave.2",
                badgeText: nil,
                accent: .indigo,
                destination: .audio
            ),
            DashboardFeatureCard(
                id: "context-lab",
                title: "情境实验室",
                subtitle: "实战演练 (L2)",
                detail: "L2",
                systemImage: "brain.head.profile",
                badgeText: nil,
                accent: .violet,
                destination: .training(mode: "L2_MIXED")
            )
        ],
        briefingCards: [
            DashboardBriefingCard(
                id: "finance-briefing",
                articleID: "finance-briefing",
                title: "Q3 Compliance Audit...",
                subtitle: "约 1 个月前",
                contextLabel: "金融与法务",
                systemImage: "briefcase",
                accent: .violet,
                destination: .briefing(articleID: "finance-briefing")
            ),
            DashboardBriefingCard(
                id: "ops-briefing",
                articleID: "ops-briefing",
                title: "Ops Handover Snapshot",
                subtitle: "查看全部",
                contextLabel: "运营交接",
                systemImage: "shippingbox",
                accent: .amber,
                destination: .briefing(articleID: "ops-briefing")
            )
        ]
    )

    static let longNameHomeState = DashboardHomeState(
        greetingName: "Hugo With A Remarkably Long Display Name",
        greetingLine: "这一版 Preview 用来验证长用户名和小屏排版仍然像成品，而不是拉扯变形。",
        moduleTitle: "首页",
        telemetryScoreText: "91% R",
        metrics: [
            DashboardMetric(id: "mastered", title: "已掌握", value: "18", footnote: "掌握稳定"),
            DashboardMetric(id: "learning", title: "学习中", value: "142", footnote: "保持输入"),
            DashboardMetric(id: "review", title: "待复习", value: "39", footnote: "需要回收")
        ],
        primaryTask: DashboardPrimaryTask(
            title: "每日闪电战",
            subtitle: "42 词 · 长文案模式",
            detail: "待复习",
            ctaTitle: "进入训练",
            accent: .violet,
            destination: .training(mode: "DAILY_BLITZ")
        ),
        trainingCards: defaultHomeState.trainingCards,
        skillCards: defaultHomeState.skillCards,
        briefingCards: defaultHomeState.briefingCards
    )
}
