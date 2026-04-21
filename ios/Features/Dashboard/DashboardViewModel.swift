import Foundation
import Observation

@MainActor
@Observable
final class DashboardViewModel {
    var selectedTab: DashboardTab
    let homeState: DashboardHomeState
    let diagnosticsSummary: DashboardDiagnosticsSummary

    init(
        selectedTab: DashboardTab = .home,
        homeState: DashboardHomeState,
        diagnosticsSummary: DashboardDiagnosticsSummary
    ) {
        self.selectedTab = selectedTab
        self.homeState = homeState
        self.diagnosticsSummary = diagnosticsSummary
    }

    var tabs: [DashboardTab] {
        DashboardTab.allCases
    }

    func selectTab(_ tab: DashboardTab) {
        selectedTab = tab
    }
}
