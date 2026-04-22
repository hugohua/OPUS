import Foundation

struct TrainingHubSection: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let entries: [TrainingHubEntry]
}

struct TrainingHubEntry: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let systemImage: String
    let accent: DashboardAccent
    let destination: DashboardDestination
    let availability: TrainingHubAvailability
}

enum TrainingHubAvailability: Equatable {
    case available(label: String?)
    case unavailable(reason: String)
}

struct TrainingHubAudioPayload: Decodable {
    let key: String
    let title: String
    let available: Bool
    let reason: String?
    let count: Int
}

struct TrainingHubReviewCardsPayload: Decodable {
    let items: [TrainingHubReviewCardItem]
    let count: Int
}

struct TrainingHubReviewCardItem: Decodable {
    let id: Int
    let word: String
}
