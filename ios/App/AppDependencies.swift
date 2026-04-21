import Foundation

struct AppDependencies {
    let runtimeConfigLoader: () throws -> RuntimeConfig
    let buildInfoProvider: () -> BuildInfo
    let tokenStore: AuthTokenStore
    let healthService: HealthCheckService

    @MainActor
    func makeDashboardViewModel() -> DashboardViewModel {
        DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )
    }

    @MainActor
    func makeDiagnosticsViewModel() -> DiagnosticsViewModel {
        DiagnosticsViewModel(
            runtimeConfigLoader: runtimeConfigLoader,
            buildInfoProvider: buildInfoProvider,
            tokenStore: tokenStore,
            healthService: healthService
        )
    }

    static func live() -> AppDependencies {
        let initialConfig = (try? RuntimeConfig.load()) ?? .fallbackLocal
        let tokenStore = KeychainTokenStore(
            service: "com.hugo.opus.ios.auth",
            account: "bearer-token"
        )
        let requestBuilder = RequestBuilder(baseURL: initialConfig.apiBaseURL)
        let apiClient = URLSessionAPIClient(
            requestBuilder: requestBuilder,
            tokenStore: tokenStore,
            logger: NetworkLogger(enabled: initialConfig.networkLoggingEnabled)
        )

        return AppDependencies(
            runtimeConfigLoader: { try RuntimeConfig.load() },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: tokenStore,
            healthService: HealthCheckService(apiClient: apiClient)
        )
    }
}
