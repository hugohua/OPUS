import SwiftUI

@main
struct OpusApp: App {
    @State private var launchCoordinator: LaunchCoordinator
    @State private var dashboardViewModel: DashboardViewModel
    @State private var diagnosticsViewModel: DiagnosticsViewModel

    init() {
        let dependencies = AppDependencies.live()
        let launchCoordinator = dependencies.makeLaunchCoordinator()
        _launchCoordinator = State(initialValue: launchCoordinator)
        _dashboardViewModel = State(initialValue: dependencies.makeDashboardViewModel())
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
                diagnosticsViewModel: diagnosticsViewModel
            )
        }
    }
}
