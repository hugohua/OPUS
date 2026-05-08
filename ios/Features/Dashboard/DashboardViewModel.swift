import Foundation
import Observation

@MainActor
@Observable
final class DashboardViewModel {
    var selectedTab: DashboardTab
    var homeState: DashboardHomeState?
    var homeContentState: OpusContentState
    let diagnosticsSummary: DashboardDiagnosticsSummary
    var pendingDestination: DashboardDestination?
    var lastHomeRefreshAt: Date?

    @ObservationIgnored private let summaryService: DashboardSummaryServing
    @ObservationIgnored private var hasLoadedHome = false
    @ObservationIgnored private var isLoadingHome = false

    init(
        selectedTab: DashboardTab = .home,
        summaryService: DashboardSummaryServing,
        diagnosticsSummary: DashboardDiagnosticsSummary,
        initialHomeState: DashboardHomeState? = nil
    ) {
        self.selectedTab = selectedTab
        self.summaryService = summaryService
        self.diagnosticsSummary = diagnosticsSummary
        self.homeState = initialHomeState
        self.homeContentState = initialHomeState == nil
            ? .loading
            : .empty(title: "", message: "")
    }

    var tabs: [DashboardTab] {
        DashboardTab.allCases
    }

    func selectTab(_ tab: DashboardTab) {
        selectedTab = tab
    }

    func loadHome(force: Bool = false) async {
        if isLoadingHome { return }
        if hasLoadedHome && !force { return }

        isLoadingHome = true
        homeContentState = .loading

        defer { isLoadingHome = false }

        do {
            homeState = try await summaryService.fetchSummary()
            homeContentState = .empty(title: "", message: "")
            hasLoadedHome = true
            lastHomeRefreshAt = Date()
        } catch {
            homeContentState = .error(
                title: "首页加载失败",
                message: "暂时无法拉取移动端 summary，请检查本地 API 与登录状态。",
                actionTitle: "重试"
            )
        }
    }

    func open(_ destination: DashboardDestination) {
        pendingDestination = destination

        switch destination {
        case .training, .reviewCards, .audio, .drive:
            selectedTab = .training
        case .arena, .diagnostics:
            selectedTab = .arena
        case .vocabulary:
            selectedTab = .vocabulary
        case .briefing, .briefingComposer, .briefingHistory:
            selectedTab = .briefing
        }
    }

    func consumePendingDestination() -> DashboardDestination? {
        let destination = pendingDestination
        pendingDestination = nil
        return destination
    }

    func resetForSessionChange() {
        selectedTab = .home
        homeState = nil
        homeContentState = .loading
        pendingDestination = nil
        lastHomeRefreshAt = nil
        hasLoadedHome = false
        isLoadingHome = false
    }
}
