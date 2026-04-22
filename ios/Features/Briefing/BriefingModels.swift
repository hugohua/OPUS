import Foundation

struct BriefingLatestPayload: Decodable, Equatable {
    let id: String
    let title: String
    let createdAt: String
    let scenario: String
    let density: String
    let content: String
}

struct BriefingIngredientsPayload: Decodable, Equatable {
    let scenario: String
    let priorityWords: [BriefingWord]
    let fillerWords: [BriefingWord]
    let availableScenarios: [String]
    let availableDensities: [String]
}

struct BriefingWord: Decodable, Equatable, Identifiable {
    let id: Int
    let word: String
    let meaning: String

    var source: String? { nil }
}

enum BriefingPhase: Equatable {
    case console
    case generating
    case reader
}
