import Foundation

protocol ArenaMissionServing {
    func fetchMission() async throws -> ArenaMissionPayload
    func submitAttempt(_ request: ArenaMissionAttemptRequest) async throws -> ArenaMissionAttemptResponse
}

struct ArenaMissionService: ArenaMissionServing {
    let apiClient: APIClient

    func fetchMission() async throws -> ArenaMissionPayload {
        let envelope = try await apiClient.send(ArenaMissionEndpoint(), as: MobileEnvelope<ArenaMissionPayload>.self)
        return envelope.data
    }

    func submitAttempt(_ request: ArenaMissionAttemptRequest) async throws -> ArenaMissionAttemptResponse {
        let envelope = try await apiClient.send(
            ArenaMissionAttemptEndpoint(request: request),
            as: MobileEnvelope<ArenaMissionAttemptResponse>.self
        )
        return envelope.data
    }
}

struct ArenaMissionEndpoint: Endpoint {
    let path = "/api/mobile/v1/arena/mission"
    let method: HTTPMethod = .get
}

struct ArenaMissionAttemptEndpoint: Endpoint {
    let path = "/api/mobile/v1/arena/attempt"
    let method: HTTPMethod = .post
    let request: ArenaMissionAttemptRequest

    var body: Data? {
        try? JSONEncoder().encode(request)
    }
}

struct ArenaMissionUnavailableService: ArenaMissionServing {
    func fetchMission() async throws -> ArenaMissionPayload {
        throw ArenaMissionUnavailableError.notConfigured
    }

    func submitAttempt(_ request: ArenaMissionAttemptRequest) async throws -> ArenaMissionAttemptResponse {
        throw ArenaMissionUnavailableError.notConfigured
    }

    private enum ArenaMissionUnavailableError: Error {
        case notConfigured
    }
}
