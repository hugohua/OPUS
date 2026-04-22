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
            ]))
        )

        await viewModel.load(force: true)

        XCTAssertEqual(viewModel.sections.count, 1)
        XCTAssertEqual(viewModel.sections.first?.entries.first?.title, "复习卡组")
    }

    @MainActor
    func testFallsBackToErrorState() async {
        let viewModel = TrainingHubViewModel(
            service: StubTrainingHubService(result: .failure(StubTrainingHubError.offline))
        )

        await viewModel.load(force: true)

        if case .error(let title, _, _) = viewModel.contentState {
            XCTAssertEqual(title, "训练页加载失败")
        } else {
            XCTFail("Expected error state")
        }
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
