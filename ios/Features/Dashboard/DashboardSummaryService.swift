import Foundation

protocol DashboardSummaryServing {
    func fetchSummary() async throws -> DashboardHomeState
}

struct DashboardSummaryService: DashboardSummaryServing {
    let apiClient: APIClient

    func fetchSummary() async throws -> DashboardHomeState {
        let envelope = try await apiClient.send(DashboardSummaryEndpoint(), as: MobileEnvelope<DashboardSummaryPayload>.self)
        return DashboardSummaryMapper.map(payload: envelope.data)
    }
}

struct DashboardSummaryEndpoint: Endpoint {
    let path = "/api/mobile/v1/dashboard/summary"
    let method: HTTPMethod = .get
}

struct DashboardSummaryPayload: Decodable {
    let userName: String
    let fsrs: DashboardSummaryFSRSPayload
    let primaryTask: DashboardSummaryPrimaryTaskPayload
    let trainingEntries: [DashboardSummaryEntryPayload]
    let skillEntries: [DashboardSummaryEntryPayload]
    let latestBriefing: DashboardSummaryBriefingPayload?
    let diagnostics: DashboardSummaryDiagnosticsPayload
}

struct DashboardSummaryFSRSPayload: Decodable {
    let mastered: Int
    let learning: Int
    let due: Int
    let telemetryScoreText: String
}

struct DashboardSummaryPrimaryTaskPayload: Decodable {
    let title: String
    let subtitle: String
    let detail: String
    let ctaTitle: String
    let mode: String
}

struct DashboardSummaryEntryPayload: Decodable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let systemImage: String
    let badgeText: String?
    let destination: DashboardSummaryDestinationPayload
}

struct DashboardSummaryDestinationPayload: Decodable {
    let kind: String
    let value: String
}

struct DashboardSummaryBriefingPayload: Decodable {
    let id: String
    let title: String
    let subtitle: String
    let contextLabel: String
    let scenario: String
}

struct DashboardSummaryDiagnosticsPayload: Decodable {
    let statusTitle: String
    let detail: String
}

enum DashboardSummaryMapper {
    static func map(payload: DashboardSummaryPayload) -> DashboardHomeState {
        DashboardHomeState(
            greetingName: payload.userName,
            greetingLine: "继续保持进步。",
            moduleTitle: "Dashboard",
            telemetryScoreText: payload.fsrs.telemetryScoreText,
            metrics: [
                DashboardMetric(id: "mastered", title: "已掌握", value: String(payload.fsrs.mastered), footnote: "掌握稳定"),
                DashboardMetric(id: "learning", title: "学习中", value: String(payload.fsrs.learning), footnote: "保持输入"),
                DashboardMetric(id: "review", title: "待复习", value: String(payload.fsrs.due), footnote: "需要回收")
            ],
            primaryTask: DashboardPrimaryTask(
                title: payload.primaryTask.title,
                subtitle: payload.primaryTask.subtitle,
                detail: payload.primaryTask.detail,
                ctaTitle: payload.primaryTask.ctaTitle,
                accent: .violet,
                destination: .training(mode: payload.primaryTask.mode)
            ),
            trainingCards: payload.trainingEntries.map(mapEntry),
            skillCards: payload.skillEntries.map(mapEntry),
            briefingCards: payload.latestBriefing.map { briefing in
                [
                    DashboardBriefingCard(
                        id: briefing.id,
                        articleID: briefing.id,
                        title: briefing.title,
                        subtitle: briefing.subtitle,
                        contextLabel: briefing.contextLabel,
                        systemImage: icon(for: briefing.scenario),
                        accent: .violet,
                        destination: .briefing(articleID: briefing.id)
                    )
                ]
            } ?? []
        )
    }

    private static func mapEntry(_ entry: DashboardSummaryEntryPayload) -> DashboardFeatureCard {
        DashboardFeatureCard(
            id: entry.id,
            title: entry.title,
            subtitle: entry.subtitle,
            detail: entry.detail,
            systemImage: entry.systemImage,
            badgeText: entry.badgeText,
            accent: accent(for: entry.id),
            destination: mapDestination(entry.destination)
        )
    }

    private static func mapDestination(_ payload: DashboardSummaryDestinationPayload) -> DashboardDestination {
        switch (payload.kind, payload.value) {
        case ("arena", "part5"):
            return .arena(path: "part5")
        case ("arena", "mission"):
            return .arena(path: "mission")
        case ("training", "review-cards"):
            return .reviewCards
        case ("training", "audio"):
            return .audio
        case ("drive", let mode):
            return .drive(mode: mode)
        case ("training", let mode):
            return .training(mode: mode)
        default:
            return .training(mode: "DAILY_BLITZ")
        }
    }

    private static func accent(for id: String) -> DashboardAccent {
        switch id {
        case "arena-blitz", "l2-mixed":
            return .violet
        case "arena-mission", "phrase-deck":
            return .indigo
        case "drive-mode", "audio":
            return .amber
        case "review-cards", "l0-mixed":
            return .emerald
        default:
            return .amber
        }
    }

    private static func icon(for scenario: String) -> String {
        switch scenario {
        case "finance_group":
            return "briefcase"
        case "hr_group":
            return "person.2"
        case "ops_group":
            return "shippingbox"
        case "market_group":
            return "megaphone"
        case "office_group":
            return "desktopcomputer"
        case "travel_group":
            return "airplane"
        default:
            return "sparkles"
        }
    }
}
