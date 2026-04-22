import XCTest
@testable import OpusApp

final class DashboardViewModelTests: XCTestCase {
    @MainActor
    func testStartsOnHomeTab() {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary,
            initialHomeState: DashboardPreviewData.defaultHomeState
        )

        XCTAssertEqual(viewModel.selectedTab, .home)
    }

    @MainActor
    func testExposesFivePrimaryTabsInExpectedOrder() {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary,
            initialHomeState: DashboardPreviewData.defaultHomeState
        )

        XCTAssertEqual(viewModel.tabs, [.home, .training, .arena, .vocabulary, .briefing])
        XCTAssertEqual(viewModel.tabs.map(\.title), ["首页", "训练", "竞技", "词库", "简报"])
    }

    @MainActor
    func testLoadsHomeStateFromSummaryService() async {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        await viewModel.loadHome(force: true)

        XCTAssertEqual(viewModel.homeState?.greetingName, "Hugo")
        XCTAssertEqual(viewModel.homeState?.trainingCards.count, 3)
        XCTAssertEqual(viewModel.homeState?.skillCards.count, 3)
        XCTAssertEqual(viewModel.homeState?.briefingCards.count, 2)
        XCTAssertEqual(viewModel.homeState?.telemetryScoreText, "94% R")
        XCTAssertEqual(viewModel.homeState?.primaryTask.title, "每日闪电战")
    }

    @MainActor
    func testUpdatesSelectedTabWhenUserNavigates() {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary,
            initialHomeState: DashboardPreviewData.defaultHomeState
        )

        viewModel.selectTab(.briefing)

        XCTAssertEqual(viewModel.selectedTab, .briefing)
    }

    @MainActor
    func testRoutesHomeDestinationIntoMatchingTab() {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary,
            initialHomeState: DashboardPreviewData.defaultHomeState
        )

        viewModel.open(.arena(path: "part5"))

        XCTAssertEqual(viewModel.selectedTab, .arena)
        XCTAssertEqual(viewModel.consumePendingDestination(), .arena(path: "part5"))
    }

    @MainActor
    func testSetsErrorStateWhenSummaryLoadFails() async {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .failure(StubDashboardSummaryError.offline)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        await viewModel.loadHome(force: true)

        if case .error(let title, _, _) = viewModel.homeContentState {
            XCTAssertEqual(title, "首页加载失败")
        } else {
            XCTFail("Expected error state")
        }
    }

    @MainActor
    func testResetsCachedHomeStateForSessionChange() async {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        await viewModel.loadHome(force: true)
        viewModel.open(.briefing(articleID: "article-1"))

        viewModel.resetForSessionChange()

        XCTAssertNil(viewModel.homeState)
        XCTAssertNil(viewModel.pendingDestination)
        XCTAssertEqual(viewModel.selectedTab, .home)
        if case .loading = viewModel.homeContentState {
        } else {
            XCTFail("Expected loading state after reset")
        }
    }
}

private enum StubDashboardSummaryError: Error {
    case offline
}

private struct StubDashboardSummaryService: DashboardSummaryServing {
    let result: Result<DashboardHomeState, Error>

    func fetchSummary() async throws -> DashboardHomeState {
        try result.get()
    }
}
