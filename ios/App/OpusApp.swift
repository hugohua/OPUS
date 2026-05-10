import SwiftUI

@main
struct OpusApp: App {
    private let dependencies: AppDependencies
    @State private var launchCoordinator: LaunchCoordinator
    @State private var dashboardViewModel: DashboardViewModel
    @State private var diagnosticsViewModel: DiagnosticsViewModel
    @State private var trainingHubViewModel: TrainingHubViewModel
    @State private var learningDiagnosticRadarViewModel: LearningDiagnosticRadarViewModel
    @State private var arenaDashboardViewModel: ArenaDashboardViewModel
    @State private var vocabularyViewModel: VocabularyViewModel
    @State private var briefingViewModel: BriefingViewModel

    init() {
        let dependencies = AppDependencies.live()
        self.dependencies = dependencies
        let launchCoordinator = dependencies.makeLaunchCoordinator()
        _launchCoordinator = State(initialValue: launchCoordinator)
        _dashboardViewModel = State(initialValue: dependencies.makeDashboardViewModel())
        _trainingHubViewModel = State(initialValue: dependencies.makeTrainingHubViewModel())
        _learningDiagnosticRadarViewModel = State(initialValue: dependencies.makeLearningDiagnosticRadarViewModel())
        _arenaDashboardViewModel = State(initialValue: dependencies.makeArenaDashboardViewModel())
        _vocabularyViewModel = State(initialValue: dependencies.makeVocabularyViewModel())
        _briefingViewModel = State(initialValue: dependencies.makeBriefingViewModel())
        _diagnosticsViewModel = State(
            initialValue: dependencies.makeDiagnosticsViewModel(
                clearStoredTokenAction: {
                    try await launchCoordinator.logout()
                }
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            AppRootView(
                launchCoordinator: launchCoordinator,
                dashboardViewModel: dashboardViewModel,
                diagnosticsViewModel: diagnosticsViewModel,
                trainingHubViewModel: trainingHubViewModel,
                learningDiagnosticRadarViewModel: learningDiagnosticRadarViewModel,
                arenaDashboardViewModel: arenaDashboardViewModel,
                vocabularyViewModel: vocabularyViewModel,
                briefingViewModel: briefingViewModel,
                makeArenaPart5ViewModel: dependencies.makeArenaPart5ViewModel,
                makeArenaMissionViewModel: dependencies.makeArenaMissionViewModel,
                makeDrivePlayerViewModel: dependencies.makeDrivePlayerViewModel
            )
        }
    }
}
