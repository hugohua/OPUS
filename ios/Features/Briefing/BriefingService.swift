import Foundation

protocol BriefingServing {
    func fetchLatest() async throws -> BriefingLatestPayload?
    func fetchIngredients(scenario: String, refresh: Bool) async throws -> BriefingIngredientsPayload
    func fetchHistory(scenario: String?, status: String?) async throws -> BriefingHistoryPayload
    func fetchArticle(id: String) async throws -> BriefingArticlePayload
    func deleteArticle(id: String) async throws
    func fetchWandWord(word: String) async throws -> BriefingWandWordPayload
    func analyze(text: String, type: BriefingWandAnalyzeType, context: String?) throws -> AsyncThrowingStream<SSEClientEvent, Error>
    func generate(scenario: String, density: String, targetWordIds: [Int]) throws -> AsyncThrowingStream<SSEClientEvent, Error>
}

struct BriefingService: BriefingServing {
    let apiClient: APIClient
    let sseClient: SSEClient

    func fetchLatest() async throws -> BriefingLatestPayload? {
        let envelope = try await apiClient.send(BriefingLatestEndpoint(), as: MobileEnvelope<BriefingLatestPayload?>.self)
        return envelope.data
    }

    func fetchIngredients(scenario: String, refresh: Bool) async throws -> BriefingIngredientsPayload {
        let envelope = try await apiClient.send(
            BriefingIngredientsEndpoint(scenario: scenario, refresh: refresh),
            as: MobileEnvelope<BriefingIngredientsPayload>.self
        )
        return envelope.data
    }

    func fetchHistory(scenario: String?, status: String?) async throws -> BriefingHistoryPayload {
        let envelope = try await apiClient.send(
            BriefingHistoryEndpoint(scenario: scenario, status: status),
            as: MobileEnvelope<BriefingHistoryPayload>.self
        )
        return envelope.data
    }

    func fetchArticle(id: String) async throws -> BriefingArticlePayload {
        let envelope = try await apiClient.send(BriefingArticleEndpoint(id: id), as: MobileEnvelope<BriefingArticlePayload>.self)
        return envelope.data
    }

    func deleteArticle(id: String) async throws {
        _ = try await apiClient.send(DeleteBriefingArticleEndpoint(id: id), as: MobileEnvelope<BriefingMutationPayload>.self)
    }

    func fetchWandWord(word: String) async throws -> BriefingWandWordPayload {
        let envelope = try await apiClient.send(BriefingWandWordEndpoint(word: word), as: MobileEnvelope<BriefingWandWordPayload>.self)
        return envelope.data
    }

    func analyze(text: String, type: BriefingWandAnalyzeType, context: String?) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        try sseClient.stream(BriefingWandAnalyzeEndpoint(text: text, type: type, context: context))
    }

    func generate(scenario: String, density: String, targetWordIds: [Int]) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        try sseClient.stream(
            BriefingGenerateEndpoint(
                scenario: scenario,
                density: density,
                targetWordIds: targetWordIds
            )
        )
    }
}

struct BriefingLatestEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/latest"
    let method: HTTPMethod = .get
}

struct BriefingIngredientsEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/ingredients"
    let method: HTTPMethod = .get
    let scenario: String
    let refresh: Bool

    var queryItems: [URLQueryItem] {
        [
            URLQueryItem(name: "scenario", value: scenario),
            URLQueryItem(name: "refresh", value: refresh ? "true" : "false")
        ]
    }
}

struct BriefingGenerateEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/generate"
    let method: HTTPMethod = .post
    let scenario: String
    let density: String
    let targetWordIds: [Int]

    var body: Data? {
        try? JSONEncoder().encode(Body(
            scenario: scenario,
            density: density,
            targetWordIds: targetWordIds
        ))
    }

    private struct Body: Encodable {
        let scenario: String
        let density: String
        let targetWordIds: [Int]
    }
}

struct BriefingArticleEndpoint: Endpoint {
    let id: String
    var path: String { "/api/mobile/v1/weaver/\(id)" }
    let method: HTTPMethod = .get
}

struct DeleteBriefingArticleEndpoint: Endpoint {
    let id: String
    var path: String { "/api/mobile/v1/weaver/\(id)" }
    let method: HTTPMethod = .delete
}

struct BriefingHistoryEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/history"
    let method: HTTPMethod = .get
    let scenario: String?
    let status: String?

    var queryItems: [URLQueryItem] {
        [
            URLQueryItem(name: "scenario", value: scenario),
            URLQueryItem(name: "status", value: status)
        ]
        .filter { $0.value?.isEmpty == false }
    }
}

struct BriefingWandWordEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/wand/word"
    let method: HTTPMethod = .get
    let word: String

    var queryItems: [URLQueryItem] {
        [URLQueryItem(name: "word", value: word)]
    }
}

struct BriefingWandAnalyzeEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/wand/analyze"
    let method: HTTPMethod = .post
    let text: String
    let type: BriefingWandAnalyzeType
    let context: String?

    var body: Data? {
        try? JSONEncoder().encode(Body(
            text: text,
            type: type == .word ? "word" : "sentence",
            context: context
        ))
    }

    private struct Body: Encodable {
        let text: String
        let type: String
        let context: String?
    }
}
