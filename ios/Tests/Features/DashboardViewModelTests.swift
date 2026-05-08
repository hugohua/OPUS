import SwiftUI
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
        XCTAssertEqual(viewModel.tabs.map(\.title), ["首页", "模拟", "竞技", "词库", "简报"])
    }

    @MainActor
    func testLoadsHomeStateFromSummaryService() async {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary
        )

        await viewModel.loadHome(force: true)

        XCTAssertEqual(viewModel.homeState?.greetingName, "Hugo")
        XCTAssertEqual(viewModel.homeState?.trainingCards.count, 5)
        XCTAssertEqual(viewModel.homeState?.skillCards.count, 3)
        XCTAssertEqual(viewModel.homeState?.briefingCards.count, 2)
        XCTAssertEqual(viewModel.homeState?.telemetryScoreText, "94% R")
        XCTAssertEqual(viewModel.homeState?.primaryTask.title, "每日闪电战")
    }

    func testDashboardHomeStartsFromPrimaryTaskWithoutIntroSections() {
        XCTAssertEqual(
            DashboardHomeLayout.visibleSections,
            [.greeting, .memorySummary, .primaryTask, .training, .skills, .briefing]
        )
        XCTAssertTrue(DashboardHomeLayout.visibleSections.contains(.greeting))
        XCTAssertTrue(DashboardHomeLayout.visibleSections.contains(.memorySummary))
    }

    func testDashboardHomeCopyUsesSimplifiedChineseLabels() {
        let labels = [
            DashboardHomeCopy.latestBriefingLabel,
            DashboardHomeCopy.viewAllBriefingsTitle
        ]

        XCTAssertEqual(DashboardHomeCopy.latestBriefingLabel, "最新简报")
        XCTAssertEqual(DashboardHomeCopy.viewAllBriefingsTitle, "查看全部")
        XCTAssertFalse(labels.contains { label in
            label.range(of: #"[A-Za-z]"#, options: String.CompareOptions.regularExpression) != nil
        })
    }

    func testDashboardHomeLayoutCollapsesGridsForAccessibilityDynamicType() {
        XCTAssertEqual(DashboardHomeLayout.trainingColumnCount(for: .large), 2)
        XCTAssertEqual(DashboardHomeLayout.skillColumnCount(for: .large), 3)
        XCTAssertEqual(DashboardHomeLayout.trainingColumnCount(for: .accessibility3), 1)
        XCTAssertEqual(DashboardHomeLayout.skillColumnCount(for: .accessibility3), 1)
    }

    func testDashboardAvatarInitialsUseFirstCharacter() {
        XCTAssertEqual(DashboardAvatarInitials.initials(for: "Hugo"), "H")
        XCTAssertEqual(DashboardAvatarInitials.initials(for: "学习者"), "学")
    }

    func testDashboardAvatarInitialsFallbackForBlankName() {
        XCTAssertEqual(DashboardAvatarInitials.initials(for: ""), "学")
        XCTAssertEqual(DashboardAvatarInitials.initials(for: "   "), "学")
    }

    func testDashboardAvatarInitialsStayCompactForLongName() {
        XCTAssertEqual(
            DashboardAvatarInitials.initials(for: "Hugo With A Remarkably Long Display Name"),
            "H"
        )
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
    func testRoutesHomeTelemetryAndBriefingActions() {
        let viewModel = DashboardViewModel(
            summaryService: StubDashboardSummaryService(result: .success(DashboardPreviewData.defaultHomeState)),
            diagnosticsSummary: DashboardPreviewData.defaultDiagnosticsSummary,
            initialHomeState: DashboardPreviewData.defaultHomeState
        )

        viewModel.open(.vocabulary(status: .review))
        XCTAssertEqual(viewModel.selectedTab, .vocabulary)
        XCTAssertEqual(viewModel.consumePendingDestination(), .vocabulary(status: .review))

        viewModel.open(.briefingComposer)
        XCTAssertEqual(viewModel.selectedTab, .briefing)
        XCTAssertEqual(viewModel.consumePendingDestination(), .briefingComposer)

        viewModel.open(.briefingHistory)
        XCTAssertEqual(viewModel.selectedTab, .briefing)
        XCTAssertEqual(viewModel.consumePendingDestination(), .briefingHistory)
    }

    func testDashboardSummaryMapperSupportsPhraseAndDriveDestinations() {
        let payload = DashboardSummaryPayload(
            userName: "Hugo",
            fsrs: DashboardSummaryFSRSPayload(
                mastered: 1,
                learning: 2,
                due: 3,
                telemetryScoreText: "60% R"
            ),
            primaryTask: DashboardSummaryPrimaryTaskPayload(
                title: "每日闪电战",
                subtitle: "20 词",
                detail: "3 个待复习",
                ctaTitle: "进入训练",
                mode: "DAILY_BLITZ"
            ),
            trainingEntries: [
                DashboardSummaryEntryPayload(
                    id: "phrase-deck",
                    title: "短语卡组",
                    subtitle: "商务搭配",
                    detail: "视觉",
                    systemImage: "square.stack.3d.up",
                    badgeText: "视觉",
                    destination: DashboardSummaryDestinationPayload(kind: "training", value: "PHRASE")
                ),
                DashboardSummaryEntryPayload(
                    id: "drive-mode",
                    title: "听力驾驶",
                    subtitle: "被动听力",
                    detail: "听力",
                    systemImage: "car",
                    badgeText: "听力",
                    destination: DashboardSummaryDestinationPayload(kind: "drive", value: "SANDWICH")
                )
            ],
            skillEntries: [],
            latestBriefing: nil,
            diagnostics: DashboardSummaryDiagnosticsPayload(
                statusTitle: "就绪",
                detail: "OK"
            )
        )

        let state = DashboardSummaryMapper.map(payload: payload)

        XCTAssertEqual(state.trainingCards.map(\.id), ["phrase-deck", "drive-mode"])
        XCTAssertEqual(state.trainingCards[0].destination, .training(mode: "PHRASE"))
        XCTAssertEqual(state.trainingCards[1].destination, .drive(mode: "SANDWICH"))
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
