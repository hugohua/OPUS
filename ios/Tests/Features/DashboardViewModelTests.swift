import XCTest
@testable import OpusApp

final class DashboardViewModelTests: XCTestCase {
    @MainActor
    func testStartsOnHomeTab() {
        let viewModel = DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        XCTAssertEqual(viewModel.selectedTab, .home)
    }

    @MainActor
    func testExposesFivePrimaryTabsInExpectedOrder() {
        let viewModel = DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        XCTAssertEqual(viewModel.tabs, [.home, .training, .arena, .vocabulary, .briefing])
        XCTAssertEqual(viewModel.tabs.map(\.title), ["首页", "训练", "竞技", "词库", "简报"])
    }

    @MainActor
    func testProvidesHomeStateForStaticDashboardRendering() {
        let viewModel = DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        XCTAssertEqual(viewModel.homeState.greetingName, "Hugo")
        XCTAssertEqual(viewModel.homeState.trainingCards.count, 3)
        XCTAssertEqual(viewModel.homeState.skillCards.count, 3)
        XCTAssertEqual(viewModel.homeState.briefingCards.count, 2)
        XCTAssertEqual(viewModel.homeState.telemetryScoreText, "94% R")
        XCTAssertEqual(viewModel.homeState.primaryTask.title, "每日闪电战")
    }

    @MainActor
    func testUpdatesSelectedTabWhenUserNavigates() {
        let viewModel = DashboardViewModel(
            homeState: DashboardPreviewData.defaultHomeState,
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        viewModel.selectTab(.briefing)

        XCTAssertEqual(viewModel.selectedTab, .briefing)
    }
}
