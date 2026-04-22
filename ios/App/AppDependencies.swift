import Foundation

struct AppDependencies {
    let runtimeConfigLoader: () throws -> RuntimeConfig
    let buildInfoProvider: () -> BuildInfo
    let tokenStore: AuthTokenStore
    let authEnvironmentStore: AuthEnvironmentStore
    let authSessionService: AuthSessionService
    let healthService: HealthCheckService

    @MainActor
    func makeDashboardViewModel() -> DashboardViewModel {
        DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )
    }

    @MainActor
    func makeDiagnosticsViewModel(
        clearStoredTokenAction: (@MainActor () async throws -> Void)? = nil
    ) -> DiagnosticsViewModel {
        DiagnosticsViewModel(
            runtimeConfigLoader: runtimeConfigLoader,
            buildInfoProvider: buildInfoProvider,
            tokenStore: tokenStore,
            healthService: healthService,
            clearStoredTokenAction: clearStoredTokenAction
        )
    }

    @MainActor
    func makeLaunchCoordinator() -> LaunchCoordinator {
        LaunchCoordinator(
            runtimeConfigLoader: runtimeConfigLoader,
            authSessionService: authSessionService,
            authEnvironmentStore: authEnvironmentStore
        )
    }

    static func live() -> AppDependencies {
        let runtimeConfigLoader: () -> RuntimeConfig = {
            RuntimeConfig.resolved()
        }
        let initialConfig = runtimeConfigLoader()
        let tokenStore = KeychainTokenStore(
            service: "com.hugo.opus.ios.auth",
            account: "bearer-token"
        )
        let authEnvironmentStore = AuthEnvironmentStore()
        let requestBuilder = RequestBuilder(baseURL: initialConfig.apiBaseURL)
        let apiClient = URLSessionAPIClient(
            requestBuilder: requestBuilder,
            tokenStore: tokenStore,
            logger: NetworkLogger(enabled: initialConfig.networkLoggingEnabled)
        )
        let authSessionService = AuthSessionService(
            apiClient: apiClient,
            tokenStore: tokenStore,
            environmentStore: authEnvironmentStore,
            currentBaseURL: { runtimeConfigLoader().apiBaseURL }
        )

        return AppDependencies(
            runtimeConfigLoader: { runtimeConfigLoader() },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: tokenStore,
            authEnvironmentStore: authEnvironmentStore,
            authSessionService: authSessionService,
            healthService: HealthCheckService(apiClient: apiClient)
        )
    }
}
