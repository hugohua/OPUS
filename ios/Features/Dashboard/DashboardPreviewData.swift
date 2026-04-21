import Foundation

enum DashboardPreviewData {
    static let defaultDiagnosticsSummary = DashboardDiagnosticsSummary(
        statusTitle: "调试环境就绪",
        detail: "Local API 与原生壳层已连接，可随时切换到诊断面板。"
    )

    static let defaultHomeState = DashboardHomeState(
        greetingName: "Hugo",
        greetingLine: "继续保持进步。",
        moduleTitle: "Dashboard",
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
            accent: .violet
        ),
        trainingCards: [
            DashboardFeatureCard(
                id: "sentence-blitz",
                title: "单句闪电战",
                subtitle: "碎片极速快测",
                detail: "Part 5",
                systemImage: "bolt",
                badgeText: "Part 5",
                accent: .violet
            ),
            DashboardFeatureCard(
                id: "reading-sniper",
                title: "阅读狙击战",
                subtitle: "沉浸商务实战",
                detail: "Part 6/7",
                systemImage: "book",
                badgeText: "Part 6/7",
                accent: .indigo
            ),
            DashboardFeatureCard(
                id: "review-stack",
                title: "复习卡组",
                subtitle: "滑动复习",
                detail: "记忆",
                systemImage: "checklist.checked",
                badgeText: "记忆",
                accent: .emerald
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
                accent: .emerald
            ),
            DashboardFeatureCard(
                id: "listening-drill",
                title: "听力训练",
                subtitle: "听力 & 逻辑 (L1)",
                detail: "L1",
                systemImage: "speaker.wave.2",
                badgeText: nil,
                accent: .indigo
            ),
            DashboardFeatureCard(
                id: "context-lab",
                title: "情境实验室",
                subtitle: "实战演练 (L2)",
                detail: "L2",
                systemImage: "brain.head.profile",
                badgeText: nil,
                accent: .violet
            )
        ],
        briefingCards: [
            DashboardBriefingCard(
                id: "finance-briefing",
                title: "Q3 Compliance Audit...",
                subtitle: "about 1 month ago",
                contextLabel: "金融与法务",
                systemImage: "briefcase",
                accent: .violet
            ),
            DashboardBriefingCard(
                id: "ops-briefing",
                title: "Ops Handover Snapshot",
                subtitle: "View All",
                contextLabel: "运营交接",
                systemImage: "shippingbox",
                accent: .amber
            )
        ]
    )

    static let longNameHomeState = DashboardHomeState(
        greetingName: "Hugo With A Remarkably Long Display Name",
        greetingLine: "这一版 Preview 用来验证长用户名和小屏排版仍然像成品，而不是拉扯变形。",
        moduleTitle: "Dashboard",
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
            accent: .violet
        ),
        trainingCards: defaultHomeState.trainingCards,
        skillCards: defaultHomeState.skillCards,
        briefingCards: defaultHomeState.briefingCards
    )
}
