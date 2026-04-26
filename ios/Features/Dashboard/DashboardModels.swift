import Foundation

typealias DashboardAccent = OpusAccent

enum DashboardDestination: Equatable, Hashable {
    case training(mode: String)
    case reviewCards
    case audio
    case arena(path: String, grammarNodeID: String? = nil)
    case briefing(articleID: String?)
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
    let destination: DashboardDestination
}

struct DashboardFeatureCard: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let systemImage: String
    let badgeText: String?
    let accent: DashboardAccent
    let destination: DashboardDestination
}

struct DashboardBriefingCard: Equatable, Identifiable {
    let id: String
    let articleID: String
    let title: String
    let subtitle: String
    let contextLabel: String
    let systemImage: String
    let accent: DashboardAccent
    let destination: DashboardDestination
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

enum DashboardHomeCopy {
    static let latestBriefingLabel = "最新简报"
    static let viewAllBriefingsTitle = "查看全部"
}
