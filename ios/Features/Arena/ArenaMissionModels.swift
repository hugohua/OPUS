import Foundation

struct ArenaMissionPayload: Codable, Equatable {
    var meta: ArenaMissionMeta
    let segments: [ArenaMissionSegment]
    let passageMarkdown: String?

    enum CodingKeys: String, CodingKey {
        case meta
        case segments
        case passageMarkdown = "passage_markdown"
    }

    var questions: [ArenaMissionQuestion] {
        segments
            .enumerated()
            .compactMap { offset, segment in
                guard let task = segment.task else { return nil }
                return ArenaMissionQuestion(
                    blankIndex: offset + 1,
                    prompt: task.questionMarkdown ?? "Fill blank \(offset + 1)",
                    options: task.options,
                    answerKey: task.answerKey
                )
            }
    }

    var passageFragments: [ArenaMissionPassageFragment] {
        let source = passageMarkdown ?? ""
        guard !source.isEmpty else {
            return []
        }

        let pattern = #"\[__BLANK_(\d+)__\]"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return [ArenaMissionPassageFragment(id: "text-0", text: source, blankIndex: nil)]
        }

        let nsSource = source as NSString
        let matches = regex.matches(in: source, range: NSRange(location: 0, length: nsSource.length))
        if matches.isEmpty {
            return [ArenaMissionPassageFragment(id: "text-0", text: source, blankIndex: nil)]
        }

        var fragments: [ArenaMissionPassageFragment] = []
        var cursor = 0

        for (index, match) in matches.enumerated() {
            let fullRange = match.range(at: 0)
            if fullRange.location > cursor {
                let text = nsSource.substring(with: NSRange(location: cursor, length: fullRange.location - cursor))
                fragments.append(ArenaMissionPassageFragment(id: "text-\(index)", text: text, blankIndex: nil))
            }

            let blankString = nsSource.substring(with: match.range(at: 1))
            fragments.append(ArenaMissionPassageFragment(
                id: "blank-\(blankString)",
                text: nil,
                blankIndex: Int(blankString)
            ))
            cursor = fullRange.location + fullRange.length
        }

        if cursor < nsSource.length {
            fragments.append(ArenaMissionPassageFragment(
                id: "text-tail",
                text: nsSource.substring(from: cursor),
                blankIndex: nil
            ))
        }

        return fragments
    }

    func snapshotPayload(targetWordBlankIndex: Int) -> ArenaMissionPayload {
        var copy = self
        copy.meta.targetWordBlankIndex = targetWordBlankIndex
        return copy
    }
}

struct ArenaMissionMeta: Codable, Equatable {
    let format: String?
    let mode: String?
    let batchSize: Int?
    let systemPromptVersion: String?
    let vocabID: Int?
    let questionSeedID: String?
    let questionType: String?
    let part: Int?
    var targetWordBlankIndex: Int?

    enum CodingKeys: String, CodingKey {
        case format
        case mode
        case batchSize = "batch_size"
        case systemPromptVersion = "sys_prompt_version"
        case vocabID = "vocabId"
        case questionSeedID = "questionSeedId"
        case questionType
        case part
        case targetWordBlankIndex = "target_word_blank_index"
    }
}

struct ArenaMissionSegment: Codable, Equatable {
    let type: String
    let contentMarkdown: String?
    let task: ArenaMissionTask?

    enum CodingKeys: String, CodingKey {
        case type
        case contentMarkdown = "content_markdown"
        case task
    }
}

struct ArenaMissionTask: Codable, Equatable {
    let style: String?
    let questionMarkdown: String?
    let options: [ArenaMissionOption]
    let answerKey: String?

    enum CodingKeys: String, CodingKey {
        case style
        case questionMarkdown = "question_markdown"
        case options
        case answerKey = "answer_key"
    }
}

struct ArenaMissionOption: Codable, Equatable, Identifiable {
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

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(text, forKey: .text)
        try container.encode(isCorrect, forKey: .isCorrect)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case text
        case isCorrect
        case isCorrectLegacy = "is_correct"
    }
}

struct ArenaMissionPassageFragment: Equatable, Identifiable {
    let id: String
    let text: String?
    let blankIndex: Int?
}

struct ArenaMissionQuestion: Equatable, Identifiable {
    let blankIndex: Int
    let prompt: String
    let options: [ArenaMissionOption]
    let answerKey: String?

    var id: Int { blankIndex }
    var displayNumber: Int { 130 + blankIndex }
}

struct ArenaMissionAnswerState: Equatable {
    let optionID: String
    let selectedText: String
    let isCorrect: Bool
    let attemptID: String?

    func withAttemptID(_ attemptID: String?) -> ArenaMissionAnswerState {
        ArenaMissionAnswerState(
            optionID: optionID,
            selectedText: selectedText,
            isCorrect: isCorrect,
            attemptID: attemptID
        )
    }
}

struct ArenaMissionSummary: Equatable {
    let answeredCount: Int
    let correctCount: Int
    let incorrectCount: Int
}

struct ArenaMissionAttemptRequest: Encodable, Equatable {
    let questionSeedId: String?
    let anchorVocabId: Int?
    let isCorrect: Bool
    let responseTimeMs: Int
    let selectedOption: String
    let questionType: String
    let part: Int
    let snapshotPayload: ArenaMissionPayload?
}

struct ArenaMissionAttemptResponse: Decodable, Equatable {
    let success: Bool
    let attemptId: String
}
