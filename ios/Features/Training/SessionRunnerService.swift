import Foundation

protocol SessionRunnerServing {
    func fetchSession(for destination: DashboardDestination) async throws -> SessionRunnerSession
    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws
    func submitAudioGrade(_ request: SessionRunnerAudioGradeRequest) async throws
}

struct SessionRunnerUnavailableService: SessionRunnerServing {
    func fetchSession(for destination: DashboardDestination) async throws -> SessionRunnerSession {
        throw SessionRunnerServiceError.unsupportedDestination
    }

    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws {
    }

    func submitAudioGrade(_ request: SessionRunnerAudioGradeRequest) async throws {
    }
}

struct SessionRunnerService: SessionRunnerServing {
    let apiClient: APIClient

    func fetchSession(for destination: DashboardDestination) async throws -> SessionRunnerSession {
        switch destination {
        case .training(let mode):
            let payload = try await apiClient.send(
                SessionRunnerBatchEndpoint(mode: mode),
                as: MobileEnvelope<SessionRunnerBatchPayload>.self
            )
            return mapBatchSession(payload.data, kind: .training(mode: mode), accent: accent(for: mode))
        case .reviewCards:
            let payload = try await apiClient.send(
                SessionRunnerReviewCardsEndpoint(),
                as: MobileEnvelope<SessionRunnerReviewCardsPayload>.self
            )
            return mapReviewSession(payload.data)
        case .audio:
            let payload = try await apiClient.send(
                SessionRunnerAudioEndpoint(),
                as: MobileEnvelope<SessionRunnerAudioPayload>.self
            )
            return mapAudioSession(payload.data)
        default:
            throw SessionRunnerServiceError.unsupportedDestination
        }
    }

    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws {
        _ = try await apiClient.send(
            SessionRunnerOutcomeEndpoint(request: request),
            as: MobileEnvelope<SessionRunnerOutcomeResponse>.self
        )
    }

    func submitAudioGrade(_ request: SessionRunnerAudioGradeRequest) async throws {
        _ = try await apiClient.send(
            SessionRunnerAudioGradeEndpoint(request: request),
            as: MobileEnvelope<SessionRunnerOutcomeResponse>.self
        )
    }

    private func mapBatchSession(
        _ payload: SessionRunnerBatchPayload,
        kind: SessionRunnerKind,
        accent: DashboardAccent
    ) -> SessionRunnerSession {
        let cards = payload.items.enumerated().map { index, item in
            let interactionSegment = item.segments.first(where: { $0.type == "interaction" })
            let textSegment = item.segments.first(where: { $0.type == "text" })
            let answerKey = interactionSegment?.task?.answerKey ?? ""
            let options = interactionSegment?.task?.options ?? []
            let choiceOptions = options.enumerated().map { optionIndex, option in
                SessionRunnerChoiceOption(
                    id: option.id ?? String(UnicodeScalar(65 + optionIndex) ?? "A"),
                    text: option.text,
                    isCorrect: option.isCorrect || option.text == answerKey
                )
            }

            let title = item.meta.targetWord
                ?? item.meta.targetZh
                ?? choiceOptions.first(where: \.isCorrect)?.text
                ?? "训练卡片"
            let prompt = interactionSegment?.task?.questionMarkdown
                ?? textSegment?.contentMarkdown
                ?? "完成本轮训练"
            let supportingText = textSegment?.contentMarkdown
                ?? textSegment?.translationCN
                ?? item.meta.definitionCN
                ?? ""

            let interaction: SessionRunnerInteraction = choiceOptions.isEmpty
                ? .grading
                : .choice(
                    options: choiceOptions,
                    answerKey: answerKey,
                    explanation: interactionSegment?.task?.explanationMarkdown
                )

            return SessionRunnerCard(
                id: "\(item.meta.vocabID ?? index)-\(index)",
                vocabID: item.meta.vocabID ?? 0,
                mode: item.meta.mode,
                title: title,
                prompt: prompt,
                supportingText: supportingText,
                detail: "\(index + 1) / \(max(payload.count, 1))",
                accent: accent,
                interaction: interaction
            )
        }

        return SessionRunnerSession(
            kind: kind,
            title: sessionTitle(for: kind),
            subtitle: sessionSubtitle(for: kind),
            cards: cards
        )
    }

    private func mapReviewSession(_ payload: SessionRunnerReviewCardsPayload) -> SessionRunnerSession {
        let cards = payload.items.enumerated().map { index, item in
            let supporting = item.collocations.isEmpty
                ? (item.meaning ?? "Visual review")
                : item.collocations.map(\.text).joined(separator: " • ")

            return SessionRunnerCard(
                id: "review-\(item.id)",
                vocabID: item.id,
                mode: "SYNTAX",
                title: item.word,
                prompt: item.meaning ?? "复习词卡",
                supportingText: supporting,
                detail: "\(index + 1) / \(max(payload.count, 1))",
                accent: .emerald
            )
        }

        return SessionRunnerSession(
            kind: .reviewCards,
            title: "复习卡组",
            subtitle: "到期优先",
            cards: cards
        )
    }

    private func mapAudioSession(_ payload: SessionRunnerAudioPayload) -> SessionRunnerSession {
        let cards = payload.items.enumerated().map { index, item in
            SessionRunnerCard(
                id: item.id,
                vocabID: item.vocabID,
                mode: "AUDIO",
                title: item.word,
                prompt: "Listen and grade your recall.",
                supportingText: item.phonetic ?? item.definition ?? "Audio queue",
                detail: "\(index + 1) / \(max(payload.items.count, 1))",
                accent: .amber
            )
        }

        return SessionRunnerSession(
            kind: .audio,
            title: "听力训练",
            subtitle: payload.available ? "Audio queue" : (payload.reason ?? "暂无待复习音频"),
            cards: cards
        )
    }

    private func sessionTitle(for kind: SessionRunnerKind) -> String {
        switch kind {
        case .training(let mode):
            switch mode {
            case "PHRASE":
                return "短语训练"
            case "CONTEXT":
                return "语境训练"
            case "CHUNKING":
                return "切块训练"
            case "DAILY_BLITZ":
                return "每日闪电战"
            default:
                return "语法训练"
            }
        case .reviewCards:
            return "复习卡组"
        case .audio:
            return "听力训练"
        }
    }

    private func sessionSubtitle(for kind: SessionRunnerKind) -> String {
        switch kind {
        case .training(let mode):
            return "移动端 Session Runner · \(mode)"
        case .reviewCards:
            return "到期优先"
        case .audio:
            return "Audio queue"
        }
    }

    private func accent(for mode: String) -> DashboardAccent {
        switch mode {
        case "CONTEXT", "L2_MIXED":
            return .indigo
        case "CHUNKING", "L1_MIXED", "AUDIO":
            return .amber
        case "PHRASE":
            return .emerald
        default:
            return .violet
        }
    }
}

enum SessionRunnerServiceError: Error {
    case unsupportedDestination
}

private struct SessionRunnerBatchEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/batch"
    let method: HTTPMethod = .post
    let mode: String

    var body: Data? {
        try? JSONSerialization.data(withJSONObject: [
            "mode": mode,
            "limit": 10,
        ])
    }
}

private struct SessionRunnerOutcomeEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/outcome"
    let method: HTTPMethod = .post
    let request: SessionRunnerOutcomeRequest

    var body: Data? {
        try? JSONSerialization.data(withJSONObject: [
            "vocabId": request.vocabID,
            "grade": request.grade,
            "mode": request.mode,
        ])
    }
}

private struct SessionRunnerAudioGradeEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/audio/grade"
    let method: HTTPMethod = .post
    let request: SessionRunnerAudioGradeRequest

    var body: Data? {
        try? JSONSerialization.data(withJSONObject: [
            "vocabId": request.vocabID,
            "grade": request.grade,
        ])
    }
}

private struct SessionRunnerReviewCardsEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/review-cards"
    let method: HTTPMethod = .get
}

private struct SessionRunnerAudioEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/audio"
    let method: HTTPMethod = .get
}

private struct SessionRunnerBatchPayload: Decodable {
    let items: [SessionRunnerBatchItem]
    let count: Int
}

private struct SessionRunnerBatchItem: Decodable {
    let meta: SessionRunnerBatchMeta
    let segments: [SessionRunnerBatchSegment]
}

private struct SessionRunnerBatchMeta: Decodable {
    let mode: String
    let vocabID: Int?
    let targetWord: String?
    let targetZh: String?
    let definitionCN: String?

    private enum CodingKeys: String, CodingKey {
        case mode
        case vocabID = "vocabId"
        case targetWord = "target_word"
        case targetZh = "target_zh"
        case definitionCN = "definition_cn"
    }
}

private struct SessionRunnerBatchSegment: Decodable {
    let type: String
    let contentMarkdown: String?
    let translationCN: String?
    let task: SessionRunnerBatchTask?

    private enum CodingKeys: String, CodingKey {
        case type
        case contentMarkdown = "content_markdown"
        case translationCN = "translation_cn"
        case task
    }
}

private struct SessionRunnerBatchTask: Decodable {
    let questionMarkdown: String
    let options: [SessionRunnerBatchOption]
    let answerKey: String
    let explanationMarkdown: String?

    private enum CodingKeys: String, CodingKey {
        case questionMarkdown = "question_markdown"
        case options
        case answerKey = "answer_key"
        case explanationMarkdown = "explanation_markdown"
    }
}

private struct SessionRunnerBatchOption: Decodable {
    let id: String?
    let text: String
    let isCorrect: Bool

    init(from decoder: Decoder) throws {
        let singleValue = try? decoder.singleValueContainer()
        if let text = try? singleValue?.decode(String.self) {
            self.id = nil
            self.text = text
            self.isCorrect = false
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        text = try container.decode(String.self, forKey: .text)
        isCorrect = (try? container.decode(Bool.self, forKey: .isCorrect))
            ?? (try? container.decode(Bool.self, forKey: .is_correct))
            ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case text
        case isCorrect
        case is_correct
    }
}

private struct SessionRunnerReviewCardsPayload: Decodable {
    let items: [SessionRunnerReviewCardItem]
    let count: Int
}

private struct SessionRunnerReviewCardItem: Decodable {
    let id: Int
    let word: String
    let meaning: String?
    let collocations: [SessionRunnerCollocation]
}

private struct SessionRunnerCollocation: Decodable {
    let text: String
}

private struct SessionRunnerAudioPayload: Decodable {
    let available: Bool
    let reason: String?
    let items: [SessionRunnerAudioItem]
}

private struct SessionRunnerAudioItem: Decodable {
    let id: String
    let vocabID: Int
    let word: String
    let phonetic: String?
    let definition: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case vocabID = "vocabId"
        case word
        case phonetic
        case definition
    }
}

private struct SessionRunnerOutcomeResponse: Decodable {
    let id: String?
}
