import Foundation

struct HealthCheckPayload: Decodable, Equatable {
    let status: String
    let timestamp: String
    let env: String
    let version: String
}

struct HealthCheckEndpoint: Endpoint {
    let path = "/api/mobile/v1/health"
    let method: HTTPMethod = .get
}

struct HealthCheckService {
    let apiClient: APIClient

    func checkHealth() async throws -> HealthCheckPayload {
        try await apiClient.send(HealthCheckEndpoint(), as: HealthCheckPayload.self)
    }
}
