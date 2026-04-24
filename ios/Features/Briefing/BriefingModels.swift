import Foundation

enum BriefingScenarioOption: String, CaseIterable, Identifiable {
    case financeGroup = "finance_group"
    case hrGroup = "hr_group"
    case opsGroup = "ops_group"
    case marketGroup = "market_group"
    case officeGroup = "office_group"
    case travelGroup = "travel_group"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .financeGroup: return "Finance"
        case .hrGroup: return "HR"
        case .opsGroup: return "Ops"
        case .marketGroup: return "Market"
        case .officeGroup: return "Office"
        case .travelGroup: return "Travel"
        }
    }
}

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

struct BriefingArticlePayload: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let createdAt: String
    let summaryZh: String
    let scenario: String
    let density: String
    let content: String
    let targetWords: [BriefingWord]

    var parsedContent: BriefingParsedContent {
        BriefingParsedContent.parse(from: content, fallbackTitle: title)
    }

    static func ephemeral(
        title: String,
        createdAt: String,
        scenario: String,
        density: String,
        content: String,
        targetWords: [BriefingWord]
    ) -> BriefingArticlePayload {
        BriefingArticlePayload(
            id: "ephemeral-\(UUID().uuidString)",
            title: title,
            createdAt: createdAt,
            summaryZh: "",
            scenario: scenario,
            density: density,
            content: content,
            targetWords: targetWords
        )
    }
}

struct BriefingParsedContent: Equatable {
    let title: String
    let bodyParagraphs: [String]
    let translationParagraphs: [String]

    static func parse(from raw: String, fallbackTitle: String) -> BriefingParsedContent {
        let cleaned = raw.replacingOccurrences(of: "**", with: "")
        let title = (capture(in: cleaned, pattern: "===TITLE===\\s*([\\s\\S]*?)\\s*===BODY===")?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            ?? fallbackTitle
        let body = (capture(in: cleaned, pattern: "===BODY===\\s*([\\s\\S]*?)(?:===TRANSLATION===|$)")?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            ?? cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        let translation = (capture(in: cleaned, pattern: "===TRANSLATION===\\s*([\\s\\S]*?)$")?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            ?? ""

        return BriefingParsedContent(
            title: title,
            bodyParagraphs: paragraphs(from: body),
            translationParagraphs: paragraphs(from: translation)
        )
    }

    private static func capture(in text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range),
              let captureRange = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[captureRange])
    }

    private static func paragraphs(from text: String) -> [String] {
        text
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

struct BriefingWord: Decodable, Equatable, Identifiable {
    let id: Int
    let word: String
    let meaning: String

    var source: String? { nil }
}

struct BriefingWandWordPayload: Decodable, Equatable {
    let vocab: BriefingWandVocab
    let etymology: BriefingWandEtymology?
    let aiInsight: BriefingWandAIInsight?

    enum CodingKeys: String, CodingKey {
        case vocab
        case etymology
        case aiInsight = "ai_insight"
    }
}

struct BriefingWandVocab: Decodable, Equatable {
    let phonetic: String
    let meaning: String
}

struct BriefingWandEtymology: Decodable, Equatable {
    let mode: String
    let memoryHook: String?
    let data: [String: String]

    enum CodingKeys: String, CodingKey {
        case mode
        case memoryHook = "memory_hook"
        case data
    }
}

struct BriefingWandAIInsight: Decodable, Equatable {
    let collocation: String
    let nuance: String
    let example: String?
}

enum BriefingHistoryStatusFilter: String, CaseIterable, Identifiable {
    case all = ""
    case new = "new"
    case archived = "archived"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "全部"
        case .new: return "未读"
        case .archived: return "归档"
        }
    }
}

struct BriefingHistoryPayload: Decodable, Equatable {
    let items: [BriefingHistoryItem]
    let availableScenarios: [String]
}

struct BriefingMutationPayload: Decodable, Equatable {
    let success: Bool
}

struct BriefingHistoryItem: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let createdAt: String
    let scenario: String
    let status: String
    let vocabPreview: String

    var isNew: Bool { status == BriefingHistoryStatusFilter.new.rawValue }
}

enum BriefingWandAnalyzeType {
    case word
    case sentence
}

enum BriefingReaderReturnTarget: Equatable {
    case console
    case history
}

enum BriefingPhase: Equatable {
    case console
    case generating
    case reader
}
