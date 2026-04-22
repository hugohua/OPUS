import XCTest
@testable import OpusApp

@MainActor
final class DiagnosticsViewModelTests: XCTestCase {
    func testHealthCheckFailureOnlyUpdatesHealthErrorState() async {
        let viewModel = DiagnosticsViewModel(
            runtimeConfigLoader: { .fallbackLocal },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: DiagnosticsMemoryTokenStore(),
            healthService: HealthCheckService(
                apiClient: DiagnosticsStubAPIClient(result: .failure(NetworkError.invalidResponse))
            )
        )

        await viewModel.runHealthCheck()

        XCTAssertNotNil(viewModel.lastHealthCheckError)
        XCTAssertNil(viewModel.lastActionError)
        XCTAssertNil(viewModel.latestHealthPayload)
    }

    func testClearStoredTokenFailureDoesNotOverwriteHealthErrorState() {
        let tokenStore = DiagnosticsMemoryTokenStore()
        tokenStore.clearError = KeychainError.unhandledStatus(-1)

        let viewModel = DiagnosticsViewModel(
            runtimeConfigLoader: { .fallbackLocal },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: tokenStore,
            healthService: HealthCheckService(
                apiClient: DiagnosticsStubAPIClient(
                    result: .success(
                        HealthCheckPayload(
                            status: "ok",
                            timestamp: "2026-04-19T00:00:00Z",
                            env: "local",
                            version: "1.0.0"
                        )
                    )
                )
            )
        )
        viewModel.lastHealthCheckError = "health failed"

        viewModel.clearStoredToken()

        XCTAssertEqual(viewModel.lastHealthCheckError, "health failed")
        XCTAssertNotNil(viewModel.lastActionError)
    }
}

private final class DiagnosticsStubAPIClient: APIClient {
    let result: Result<HealthCheckPayload, Error>

    init(result: Result<HealthCheckPayload, Error>) {
        self.result = result
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T : Decodable {
        switch result {
        case .success(let payload):
            return payload as! T
        case .failure(let error):
            throw error
        }
    }
}

private final class DiagnosticsMemoryTokenStore: AuthTokenStore {
    var token: String?
    var clearError: Error?

    func fetchToken() throws -> String? {
        token
    }

    func saveToken(_ token: String) throws {
        self.token = token
    }

    func clearToken() throws {
        if let clearError {
            throw clearError
        }

        token = nil
    }
}
