import SwiftUI

@main
struct OpusApp: App {
    @State private var dashboardViewModel: DashboardViewModel
    @State private var diagnosticsViewModel: DiagnosticsViewModel

    init() {
        let dependencies = AppDependencies.live()
        _dashboardViewModel = State(initialValue: dependencies.makeDashboardViewModel())
        _diagnosticsViewModel = State(initialValue: dependencies.makeDiagnosticsViewModel())
    }

    var body: some Scene {
        WindowGroup {
            DashboardTabContainerView(
                viewModel: dashboardViewModel,
                diagnosticsViewModel: diagnosticsViewModel
            )
        }
    }
}
