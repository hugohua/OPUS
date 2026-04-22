import Foundation

protocol BriefingServing {
    func fetchLatest() async throws -> BriefingLatestPayload?
    func fetchIngredients(scenario: String, refresh: Bool) async throws -> BriefingIngredientsPayload
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
