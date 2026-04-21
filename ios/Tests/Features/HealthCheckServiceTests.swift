import XCTest
@testable import OpusApp

final class HealthCheckServiceTests: XCTestCase {
    func testChecksMobileHealthEndpoint() async throws {
        let apiClient = StubAPIClient(
            result: .success(
                HealthCheckPayload(
                    status: "ok",
                    timestamp: "2026-04-19T00:00:00Z",
                    env: "local",
                    version: "1.0.0"
                )
            )
        )
        let service = HealthCheckService(apiClient: apiClient)

        let payload = try await service.checkHealth()

        XCTAssertEqual(apiClient.lastEndpointPath, "/api/mobile/v1/health")
        XCTAssertEqual(apiClient.lastMethod, .get)
        XCTAssertEqual(payload.status, "ok")
    }

    func testPropagatesClientErrors() async {
        let apiClient = StubAPIClient(result: .failure(NetworkError.invalidResponse))
        let service = HealthCheckService(apiClient: apiClient)

        await XCTAssertThrowsErrorAsync(try await service.checkHealth()) { error in
            XCTAssertEqual(error as? NetworkError, .invalidResponse)
        }
    }
}

private final class StubAPIClient: APIClient {
    var lastEndpointPath: String?
    var lastMethod: HTTPMethod?
    let result: Result<HealthCheckPayload, Error>

    init(result: Result<HealthCheckPayload, Error>) {
        self.result = result
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T : Decodable {
        lastEndpointPath = endpoint.path
        lastMethod = endpoint.method

        switch result {
        case .success(let payload):
            return payload as! T
        case .failure(let error):
            throw error
        }
    }
}
