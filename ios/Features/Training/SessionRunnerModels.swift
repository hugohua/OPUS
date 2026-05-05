import Foundation

enum SessionRunnerKind: Equatable {
    case training(mode: String)
    case reviewCards
    case audio
}

struct SessionRunnerChoiceOption: Equatable, Identifiable {
    let id: String
    let text: String
    let isCorrect: Bool
}

struct SessionRunnerFSRSPreview: Equatable, Decodable {
    let again: String?
    let hard: String?
    let good: String?
    let easy: String?
}

struct SessionRunnerEtymologyPart: Equatable, Decodable, Identifiable {
    let part: String
    let meaningCN: String?

    var id: String {
        "\(part)-\(meaningCN ?? "")"
    }

    private enum CodingKeys: String, CodingKey {
        case part
        case meaningCN = "meaning_cn"
        case meaning
    }

    init(part: String, meaningCN: String?) {
        self.part = part
        self.meaningCN = meaningCN
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        part = try container.decode(String.self, forKey: .part)
        meaningCN = (try? container.decodeIfPresent(String.self, forKey: .meaningCN))
            ?? (try? container.decodeIfPresent(String.self, forKey: .meaning))
    }
}

struct SessionRunnerEtymology: Equatable, Decodable {
    let mode: String?
    let memoryHook: String?
    let logic: String?
    let components: [SessionRunnerEtymologyPart]

    var displayText: String? {
        if let memoryHook, !memoryHook.isEmpty {
            return memoryHook
        }
        if let logic, !logic.isEmpty {
            return logic
        }
        return nil
    }

    private enum CodingKeys: String, CodingKey {
        case mode
        case memoryHook = "memory_hook"
        case data
    }

    private enum DataCodingKeys: String, CodingKey {
        case logicCN = "logic_cn"
        case logic
        case roots
        case components
    }

    init(
        mode: String?,
        memoryHook: String?,
        logic: String?,
        components: [SessionRunnerEtymologyPart] = []
    ) {
        self.mode = mode
        self.memoryHook = memoryHook
        self.logic = logic
        self.components = components
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mode = try container.decodeIfPresent(String.self, forKey: .mode)
        memoryHook = try container.decodeIfPresent(String.self, forKey: .memoryHook)

        if let data = try? container.nestedContainer(keyedBy: DataCodingKeys.self, forKey: .data) {
            logic = (try? data.decodeIfPresent(String.self, forKey: .logicCN))
                ?? (try? data.decodeIfPresent(String.self, forKey: .logic))
            components = (try? data.decodeIfPresent([SessionRunnerEtymologyPart].self, forKey: .roots))
                ?? (try? data.decodeIfPresent([SessionRunnerEtymologyPart].self, forKey: .components))
                ?? []
        } else {
            logic = nil
            components = []
        }
    }
}

struct SessionRunnerPhraseFlashcard: Equatable {
    let phraseMarkdown: String
    let translation: String
    let targetWord: String
    let definition: String
    let phonetic: String?
    let userNote: String?
    let etymology: SessionRunnerEtymology?
    let fsrsPreview: SessionRunnerFSRSPreview?

    init(
        phraseMarkdown: String,
        translation: String,
        targetWord: String,
        definition: String,
        phonetic: String?,
        userNote: String?,
        etymology: SessionRunnerEtymology? = nil,
        fsrsPreview: SessionRunnerFSRSPreview?
    ) {
        self.phraseMarkdown = phraseMarkdown
        self.translation = translation
        self.targetWord = targetWord
        self.definition = definition
        self.phonetic = phonetic
        self.userNote = userNote
        self.etymology = etymology
        self.fsrsPreview = fsrsPreview
    }
}

struct SessionRunnerPhraseDisplay: Equatable {
    let targetWord: String
    let definition: String
    let logic: String

    init(targetWord: String, definition: String, logic: String = "") {
        self.targetWord = targetWord
        self.definition = definition
        self.logic = logic
    }

    var cleanedDefinition: String {
        var value = definition.trimmingCharacters(in: .whitespacesAndNewlines)
        let original = value
        let target = targetWord.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !target.isEmpty else { return value }

        while value.range(
            of: target,
            options: [.caseInsensitive, .anchored]
        ) != nil {
            value.removeFirst(target.count)
            value = value.trimmingCharacters(in: .whitespacesAndNewlines)

            if value.first == ":" || value.first == "：" {
                value.removeFirst()
                value = value.trimmingCharacters(in: .whitespacesAndNewlines)
            } else {
                return original
            }
        }

        return value.isEmpty ? original : value
    }

    var logicLead: String {
        splitLogic.lead
    }

    var logicResult: String {
        splitLogic.result
    }

    var hasSplitLogic: Bool {
        !logicLead.isEmpty && !logicResult.isEmpty
    }

    private var splitLogic: (lead: String, result: String) {
        let value = logic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return ("", "") }

        let arrowRanges = ["→", "->", "=>"].compactMap { token -> Range<String.Index>? in
            value.range(of: token)
        }

        guard let range = arrowRanges.min(by: { $0.lowerBound < $1.lowerBound }) else {
            return (value, "")
        }

        let lead = value[..<range.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
        let result = value[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines)
        return (lead, result)
    }
}

enum SessionRunnerInteraction: Equatable {
    case choice(options: [SessionRunnerChoiceOption], answerKey: String, explanation: String?)
    case phraseFlashcard(SessionRunnerPhraseFlashcard)
    case grading
}

struct SessionRunnerCard: Equatable, Identifiable {
    let id: String
    let vocabID: Int
    let mode: String
    let title: String
    let prompt: String
    let supportingText: String
    let detail: String
    let accent: DashboardAccent
    let interaction: SessionRunnerInteraction

    init(
        id: String,
        vocabID: Int,
        mode: String,
        title: String,
        prompt: String,
        supportingText: String,
        detail: String,
        accent: DashboardAccent,
        interaction: SessionRunnerInteraction = .grading
    ) {
        self.id = id
        self.vocabID = vocabID
        self.mode = mode
        self.title = title
        self.prompt = prompt
        self.supportingText = supportingText
        self.detail = detail
        self.accent = accent
        self.interaction = interaction
    }
}

struct SessionRunnerSession: Equatable {
    let kind: SessionRunnerKind
    let title: String
    let subtitle: String
    let cards: [SessionRunnerCard]
}

struct SessionRunnerOutcomeRequest: Equatable {
    let vocabID: Int
    let grade: Int
    let mode: String
}

struct SessionRunnerAudioGradeRequest: Equatable {
    let vocabID: Int
    let grade: Int
}
