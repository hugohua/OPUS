import Foundation

enum DashboardAccent: String {
    case violet
    case emerald
    case amber
    case indigo
    case slate
}

struct DashboardMetric: Equatable, Identifiable {
    let id: String
    let title: String
    let value: String
    let footnote: String
}

struct DashboardPrimaryTask: Equatable {
    let title: String
    let subtitle: String
    let detail: String
    let ctaTitle: String
    let accent: DashboardAccent
}

struct DashboardFeatureCard: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let systemImage: String
    let badgeText: String?
    let accent: DashboardAccent
}

struct DashboardBriefingCard: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let contextLabel: String
    let systemImage: String
    let accent: DashboardAccent
}

struct DashboardDiagnosticsSummary: Equatable {
    let statusTitle: String
    let detail: String
}

struct DashboardHomeState: Equatable {
    let greetingName: String
    let greetingLine: String
    let moduleTitle: String
    let telemetryScoreText: String
    let metrics: [DashboardMetric]
    let primaryTask: DashboardPrimaryTask
    let trainingCards: [DashboardFeatureCard]
    let skillCards: [DashboardFeatureCard]
    let briefingCards: [DashboardBriefingCard]
}
