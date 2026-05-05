import Foundation

struct AppDependencies {
    let runtimeConfigLoader: () throws -> RuntimeConfig
    let buildInfoProvider: () -> BuildInfo
    let tokenStore: AuthTokenStore
    let authEnvironmentStore: AuthEnvironmentStore
    let authSessionService: AuthSessionService
    let healthService: HealthCheckService
    let dashboardSummaryService: DashboardSummaryService
    let trainingHubService: TrainingHubService
    let sessionRunnerService: SessionRunnerService
    let arenaDashboardService: ArenaDashboardService
    let arenaPart5Service: ArenaPart5Service
    let arenaMissionService: ArenaMissionService
    let driveService: DriveService
    let vocabularyService: VocabularyService
    let briefingService: BriefingService

    @MainActor
    func makeDashboardViewModel() -> DashboardViewModel {
        DashboardViewModel(
            summaryService: dashboardSummaryService,
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

    @MainActor
    func makeTrainingHubViewModel() -> TrainingHubViewModel {
        TrainingHubViewModel(
            service: trainingHubService,
            makeSessionRunnerViewModel: { destination in
                makeSessionRunnerViewModel(destination: destination)
            }
        )
    }

    @MainActor
    func makeSessionRunnerViewModel(destination: DashboardDestination) -> SessionRunnerViewModel {
        SessionRunnerViewModel(
            destination: destination,
            service: sessionRunnerService,
            ttsService: driveService,
            audioPlayer: DriveAudioPlayer()
        )
    }

    @MainActor
    func makeArenaDashboardViewModel() -> ArenaDashboardViewModel {
        ArenaDashboardViewModel(service: arenaDashboardService)
    }

    @MainActor
    func makeArenaMissionViewModel() -> ArenaMissionViewModel {
        ArenaMissionViewModel(service: arenaMissionService)
    }

    @MainActor
    func makeArenaPart5ViewModel(grammarNodeID: String?) -> ArenaPart5ViewModel {
        ArenaPart5ViewModel(grammarNodeID: grammarNodeID, service: arenaPart5Service)
    }

    @MainActor
    func makeDrivePlayerViewModel(mode: String) -> DrivePlayerViewModel {
        DrivePlayerViewModel(
            mode: mode,
            playlistService: driveService,
            ttsService: driveService,
            audioPlayer: DriveAudioPlayer()
        )
    }

    @MainActor
    func makeVocabularyViewModel() -> VocabularyViewModel {
        VocabularyViewModel(service: vocabularyService)
    }

    @MainActor
    func makeBriefingViewModel() -> BriefingViewModel {
        BriefingViewModel(service: briefingService)
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
        let sseClient = SSEClient(
            requestBuilder: requestBuilder,
            tokenStore: tokenStore
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
            healthService: HealthCheckService(apiClient: apiClient),
            dashboardSummaryService: DashboardSummaryService(apiClient: apiClient),
            trainingHubService: TrainingHubService(apiClient: apiClient),
            sessionRunnerService: SessionRunnerService(apiClient: apiClient),
            arenaDashboardService: ArenaDashboardService(apiClient: apiClient),
            arenaPart5Service: ArenaPart5Service(apiClient: apiClient),
            arenaMissionService: ArenaMissionService(apiClient: apiClient),
            driveService: DriveService(apiClient: apiClient),
            vocabularyService: VocabularyService(apiClient: apiClient),
            briefingService: BriefingService(apiClient: apiClient, sseClient: sseClient)
        )
    }
}
