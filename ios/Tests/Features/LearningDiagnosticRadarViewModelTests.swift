import XCTest
@testable import OpusApp

final class LearningDiagnosticRadarViewModelTests: XCTestCase {
    @MainActor
    func testLoadsRadarPayloadFromService() async {
        let viewModel = LearningDiagnosticRadarViewModel(
            service: StubLearningDiagnosticRadarService(result: .success(.fixture))
        )

        await viewModel.load(force: true)

        XCTAssertEqual(viewModel.payload?.totalAttempts, 7)
        XCTAssertEqual(viewModel.payload?.weakest?.label, "基础语法")
        if case .empty(let title, _, _) = viewModel.contentState {
            XCTAssertEqual(title, "")
        } else {
            XCTFail("Expected content-ready empty sentinel")
        }
    }

    @MainActor
    func testUsesEmptyStateWhenThereIsNoRadarData() async {
        let viewModel = LearningDiagnosticRadarViewModel(
            service: StubLearningDiagnosticRadarService(result: .success(.empty))
        )

        await viewModel.load(force: true)

        if case .empty(let title, _, _) = viewModel.contentState {
            XCTAssertEqual(title, "暂无综合诊断")
        } else {
            XCTFail("Expected empty state")
        }
    }

    @MainActor
    func testFallsBackToErrorState() async {
        let viewModel = LearningDiagnosticRadarViewModel(
            service: StubLearningDiagnosticRadarService(result: .failure(StubLearningDiagnosticRadarError.offline))
        )

        await viewModel.load(force: true)

        if case .error(let title, _, _) = viewModel.contentState {
            XCTAssertEqual(title, "综合诊断加载失败")
        } else {
            XCTFail("Expected error state")
        }
    }
}

private enum StubLearningDiagnosticRadarError: Error {
    case offline
}

private struct StubLearningDiagnosticRadarService: LearningDiagnosticRadarServing {
    let result: Result<LearningDiagnosticRadarPayload, Error>

    func fetchRadar() async throws -> LearningDiagnosticRadarPayload {
        try result.get()
    }
}

private extension LearningDiagnosticRadarPayload {
    static let fixture = LearningDiagnosticRadarPayload(
        radarData: [
            LearningDiagnosticRadarPoint(subject: "基础语法", A: 42, fullMark: 100),
        ],
        weakest: LearningDiagnosticWeaknessProfile(
            questionType: "GRAMMAR",
            label: "基础语法",
            total: 7,
            correct: 3,
            accuracy: 42,
            avgResponseMs: 3200
        ),
        totalAttempts: 7
    )

    static let empty = LearningDiagnosticRadarPayload(
        radarData: [],
        weakest: nil,
        totalAttempts: 0
    )
}
