import Foundation

protocol ArenaPart5Serving {
    func fetchQuestions(_ request: ArenaPart5FetchRequest) async throws -> [ArenaPart5Question]
    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws
    func submitAttempt(_ request: ArenaPart5AttemptRequest) async throws -> ArenaPart5AttemptResponse
}

struct ArenaPart5Service: ArenaPart5Serving {
    let apiClient: APIClient

    func fetchQuestions(_ request: ArenaPart5FetchRequest) async throws -> [ArenaPart5Question] {
        let envelope = try await apiClient.send(
            ArenaPart5BatchEndpoint(request: request),
            as: MobileEnvelope<ArenaPart5BatchPayload>.self
        )
        return mapBatch(envelope.data, fallbackGrammarNodeID: request.grammarNodeID)
    }

    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws {
        _ = try await apiClient.send(
            ArenaPart5OutcomeEndpoint(request: request),
            as: MobileEnvelope<ArenaPart5OutcomeResponse>.self
        )
    }

    func submitAttempt(_ request: ArenaPart5AttemptRequest) async throws -> ArenaPart5AttemptResponse {
        let envelope = try await apiClient.send(
            ArenaPart5AttemptEndpoint(request: request),
            as: MobileEnvelope<ArenaPart5AttemptResponse>.self
        )
        return envelope.data
    }

    private func mapBatch(
        _ payload: ArenaPart5BatchPayload,
        fallbackGrammarNodeID: String?
    ) -> [ArenaPart5Question] {
        payload.items.enumerated().compactMap { index, item in
            let interactionSegment = item.segments.first(where: { $0.type == "interaction" })
            let textSegment = item.segments.first(where: { $0.type == "text" })
            guard let task = interactionSegment?.task else { return nil }
            let answerKey = task.answerKey ?? ""

            let options = task.options.enumerated().map { optionIndex, option in
                ArenaPart5Option(
                    id: option.id ?? String(UnicodeScalar(65 + optionIndex) ?? "A"),
                    text: option.text,
                    isCorrect: option.isCorrect || option.text == answerKey
                )
            }

            return ArenaPart5Question(
                id: item.meta.questionSeedID ?? "\(item.meta.vocabID ?? index)-\(index)",
                vocabID: item.meta.vocabID ?? -1,
                mode: item.meta.mode,
                prompt: task.questionMarkdown,
                stem: textSegment?.contentMarkdown
                    ?? textSegment?.translationCN
                    ?? item.meta.definitionCN
                    ?? "Choose the best answer.",
                options: options,
                explanation: task.explanationMarkdown,
                questionSeedID: item.meta.questionSeedID,
                questionType: item.meta.questionType ?? "GRAMMAR",
                grammarNodeID: item.meta.grammarNodeID ?? fallbackGrammarNodeID
            )
        }
    }
}

private struct ArenaPart5BatchEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/batch"
    let method: HTTPMethod = .post
    let request: ArenaPart5FetchRequest

    var body: Data? {
        var payload: [String: Any] = [
            "mode": "ARENA_PART5",
            "limit": request.limit,
            "excludeVocabIds": [],
        ]

        if let grammarNodeID = request.grammarNodeID {
            payload["grammarNodeId"] = grammarNodeID
        }

        return try? JSONSerialization.data(withJSONObject: payload)
    }
}

private struct ArenaPart5OutcomeEndpoint: Endpoint {
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

private struct ArenaPart5AttemptEndpoint: Endpoint {
    let path = "/api/mobile/v1/arena/attempt"
    let method: HTTPMethod = .post
    let request: ArenaPart5AttemptRequest

    var body: Data? {
        try? JSONEncoder().encode(request)
    }
}

private struct ArenaPart5BatchPayload: Decodable {
    let items: [ArenaPart5BatchItem]
    let count: Int?
}

private struct ArenaPart5BatchItem: Decodable {
    let meta: ArenaPart5BatchMeta
    let segments: [ArenaPart5BatchSegment]
}

private struct ArenaPart5BatchMeta: Decodable {
    let mode: String
    let vocabID: Int?
    let definitionCN: String?
    let questionSeedID: String?
    let questionType: String?
    let grammarNodeID: String?

    private enum CodingKeys: String, CodingKey {
        case mode
        case vocabID = "vocabId"
        case definitionCN = "definition_cn"
        case questionSeedID = "questionSeedId"
        case questionType
        case grammarNodeID = "grammarNodeId"
    }
}

private struct ArenaPart5BatchSegment: Decodable {
    let type: String
    let contentMarkdown: String?
    let translationCN: String?
    let task: ArenaPart5BatchTask?

    private enum CodingKeys: String, CodingKey {
        case type
        case contentMarkdown = "content_markdown"
        case translationCN = "translation_cn"
        case task
    }
}

private struct ArenaPart5BatchTask: Decodable {
    let questionMarkdown: String
    let options: [ArenaPart5BatchOption]
    let answerKey: String?
    let explanationMarkdown: String?

    private enum CodingKeys: String, CodingKey {
        case questionMarkdown = "question_markdown"
        case options
        case answerKey = "answer_key"
        case explanationMarkdown = "explanation_markdown"
    }
}

private struct ArenaPart5BatchOption: Decodable {
    let id: String?
    let text: String
    let isCorrect: Bool

    init(from decoder: Decoder) throws {
        if let singleValue = try? decoder.singleValueContainer(), let text = try? singleValue.decode(String.self) {
            self.id = nil
            self.text = text
            self.isCorrect = false
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        text = try container.decode(String.self, forKey: .text)
        isCorrect = try container.decodeIfPresent(Bool.self, forKey: .isCorrect)
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

private struct ArenaPart5OutcomeResponse: Decodable {
    let id: String?
}
