import XCTest
@testable import OpusApp

final class TrainingHubViewModelTests: XCTestCase {
    @MainActor
    func testLoadsSectionsFromService() async {
        let viewModel = TrainingHubViewModel(
            service: StubTrainingHubService(result: .success([
                TrainingHubSection(
                    id: "core",
                    title: "核心训练入口",
                    subtitle: nil,
                    entries: [
                        TrainingHubEntry(
                            id: "review",
                            title: "复习卡组",
                            subtitle: "滑动复习",
                            detail: "记忆",
                            systemImage: "checklist.checked",
                            accent: .emerald,
                            destination: .reviewCards,
                            availability: .available(label: "5 张可复习")
                        )
                    ]
                )
            ])),
            makeSessionRunnerViewModel: { destination in
                SessionRunnerViewModel(destination: destination, service: SessionRunnerUnavailableService())
            }
        )

        await viewModel.load(force: true)

        XCTAssertEqual(viewModel.sections.count, 1)
        XCTAssertEqual(viewModel.sections.first?.entries.first?.title, "复习卡组")
    }

    @MainActor
    func testFallsBackToErrorState() async {
        let viewModel = TrainingHubViewModel(
            service: StubTrainingHubService(result: .failure(StubTrainingHubError.offline)),
            makeSessionRunnerViewModel: { destination in
                SessionRunnerViewModel(destination: destination, service: SessionRunnerUnavailableService())
            }
        )

        await viewModel.load(force: true)

        if case .error(let title, _, _) = viewModel.contentState {
            XCTAssertEqual(title, "训练页加载失败")
        } else {
            XCTFail("Expected error state")
        }
    }

    @MainActor
    func testBuildsArenaRoutesFromDashboardDestinations() {
        let viewModel = TrainingHubViewModel(
            service: StubTrainingHubService(result: .success([])),
            makeSessionRunnerViewModel: { destination in
                SessionRunnerViewModel(destination: destination, service: SessionRunnerUnavailableService())
            }
        )

        XCTAssertEqual(
            viewModel.route(for: .arena(path: "part5", grammarNodeID: "GRAMMAR_NODE_42")),
            .arenaPart5(grammarNodeID: "GRAMMAR_NODE_42")
        )
        XCTAssertEqual(
            viewModel.route(for: .arena(path: "mission")),
            .arenaMission
        )
    }

    @MainActor
    func testBuildsDriveRouteFromDashboardDestination() {
        let viewModel = TrainingHubViewModel(
            service: StubTrainingHubService(result: .success([])),
            makeSessionRunnerViewModel: { destination in
                SessionRunnerViewModel(destination: destination, service: SessionRunnerUnavailableService())
            }
        )

        XCTAssertEqual(
            viewModel.route(for: .drive(mode: "SANDWICH")),
            .drive(mode: "SANDWICH")
        )
    }
}

private enum StubTrainingHubError: Error {
    case offline
}

private struct StubTrainingHubService {
    let result: Result<[TrainingHubSection], Error>
}

extension StubTrainingHubService: TrainingHubServing {
    func fetchTrainingSections() async throws -> [TrainingHubSection] {
        try result.get()
    }
}
