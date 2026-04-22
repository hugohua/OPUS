import Foundation

protocol ArenaDashboardServing {
    func fetchOverview() async throws -> ArenaOverviewPayload
    func fetchMatrix(domain: String) async throws -> ArenaMatrixPayload?
}

struct ArenaDashboardService: ArenaDashboardServing {
    let apiClient: APIClient

    func fetchOverview() async throws -> ArenaOverviewPayload {
        let envelope = try await apiClient.send(ArenaOverviewEndpoint(), as: MobileEnvelope<ArenaOverviewPayload>.self)
        return envelope.data
    }

    func fetchMatrix(domain: String) async throws -> ArenaMatrixPayload? {
        let envelope = try await apiClient.send(ArenaMatrixEndpoint(domain: domain), as: MobileEnvelope<ArenaMatrixPayload?>.self)
        return envelope.data
    }
}

struct ArenaOverviewEndpoint: Endpoint {
    let path = "/api/mobile/v1/arena/overview"
    let method: HTTPMethod = .get
}

struct ArenaMatrixEndpoint: Endpoint {
    let path = "/api/mobile/v1/arena/matrix"
    let method: HTTPMethod = .get
    let domain: String

    var queryItems: [URLQueryItem] {
        [URLQueryItem(name: "domain", value: domain)]
    }
}
