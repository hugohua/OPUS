import Foundation

struct ArenaPart5FetchRequest: Equatable {
    let grammarNodeID: String?
    let limit: Int
}

struct ArenaPart5Option: Decodable, Equatable, Identifiable {
    let id: String
    let text: String
    let isCorrect: Bool

    init(id: String, text: String, isCorrect: Bool) {
        self.id = id
        self.text = text
        self.isCorrect = isCorrect
    }

    init(from decoder: Decoder) throws {
        if let singleValue = try? decoder.singleValueContainer(), let text = try? singleValue.decode(String.self) {
            self.id = text
            self.text = text
            self.isCorrect = false
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        let text = try container.decode(String.self, forKey: .text)
        self.id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? text.lowercased().replacingOccurrences(of: " ", with: "-")
        self.text = text
        self.isCorrect = try container.decodeIfPresent(Bool.self, forKey: .isCorrect)
            ?? container.decodeIfPresent(Bool.self, forKey: .isCorrectLegacy)
            ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case text
        case isCorrect
        case isCorrectLegacy = "is_correct"
    }
}

struct ArenaPart5Question: Equatable, Identifiable {
    let id: String
    let vocabID: Int
    let mode: String
    let prompt: String
    let stem: String
    let options: [ArenaPart5Option]
    let explanation: String?
    let questionSeedID: String?
    let questionType: String
    let grammarNodeID: String?

    var correctOptionID: String? {
        options.first(where: \.isCorrect)?.id
    }
}

struct ArenaPart5Summary: Equatable {
    let answeredCount: Int
    let correctCount: Int
    let incorrectCount: Int
}

struct ArenaPart5AttemptRequest: Encodable, Equatable {
    let questionSeedId: String?
    let anchorVocabId: Int?
    let grammarNodeId: String?
    let isCorrect: Bool
    let responseTimeMs: Int
    let selectedOption: String
    let questionType: String
    let part: Int
}

struct ArenaPart5AttemptResponse: Decodable, Equatable {
    let success: Bool
    let attemptId: String
}
