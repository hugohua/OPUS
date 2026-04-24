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
        XCTAssertNil(viewModel.actionFeedback)
        XCTAssertNil(viewModel.latestHealthPayload)
    }

    func testReloadConfigClearsStaleHealthStateAndPublishesRefreshFeedback() {
        let refreshedConfig = RuntimeConfig(
            appEnvironment: .staging,
            apiBaseURL: URL(string: "https://staging.example.com")!,
            networkLoggingEnabled: false,
            displayNameSuffix: "Staging",
            allowsInsecureLocalLoads: false
        )
        let refreshedBuildInfo = BuildInfo(
            displayName: "OPUS Staging",
            bundleIdentifier: "dev.opus.staging",
            appVersion: "2.0.0",
            buildNumber: "42",
            deviceName: "iPhone",
            systemVersion: "26.0"
        )
        let viewModel = DiagnosticsViewModel(
            runtimeConfigLoader: { refreshedConfig },
            buildInfoProvider: { refreshedBuildInfo },
            tokenStore: DiagnosticsMemoryTokenStore(),
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
        viewModel.latestHealthPayload = HealthCheckPayload(
            status: "ok",
            timestamp: "2026-04-19T00:00:00Z",
            env: "local",
            version: "1.0.0"
        )
        viewModel.lastHealthCheckError = "old error"

        viewModel.reloadConfig()

        XCTAssertEqual(viewModel.runtimeConfig, refreshedConfig)
        XCTAssertEqual(viewModel.buildInfo, refreshedBuildInfo)
        XCTAssertNil(viewModel.latestHealthPayload)
        XCTAssertNil(viewModel.lastHealthCheckError)
        XCTAssertEqual(
            viewModel.actionFeedback,
            .success("配置已刷新，请重新执行健康检查。")
        )
    }

    func testClearStoredTokenFailureDoesNotOverwriteHealthErrorState() async {
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

        await viewModel.clearStoredToken()

        XCTAssertEqual(viewModel.lastHealthCheckError, "health failed")
        XCTAssertEqual(
            viewModel.actionFeedback,
            .failure(KeychainError.unhandledStatus(-1).localizedDescription)
        )
    }

    func testClearStoredTokenSuccessResetsTransientDiagnosticsState() async {
        let tokenStore = DiagnosticsMemoryTokenStore()
        try? tokenStore.saveToken("token-1")
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
            ),
            clearStoredTokenAction: {
                try tokenStore.clearToken()
            }
        )
        viewModel.latestHealthPayload = HealthCheckPayload(
            status: "ok",
            timestamp: "2026-04-19T00:00:00Z",
            env: "local",
            version: "1.0.0"
        )
        viewModel.lastHealthCheckError = "stale health state"
        viewModel.actionFeedback = .success("旧状态")

        await viewModel.clearStoredToken()

        XCTAssertEqual(viewModel.tokenStatusText, "No stored token")
        XCTAssertNil(viewModel.latestHealthPayload)
        XCTAssertNil(viewModel.lastHealthCheckError)
        XCTAssertNil(viewModel.actionFeedback)
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
