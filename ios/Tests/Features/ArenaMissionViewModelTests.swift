import XCTest
@testable import OpusApp

final class ArenaMissionViewModelTests: XCTestCase {
    @MainActor
    func testLoadsMissionAndStartsOnFirstBlank() async {
        let service = StubArenaMissionService()
        let viewModel = ArenaMissionViewModel(service: service)

        await viewModel.loadMission(force: true)

        XCTAssertEqual(viewModel.questions.count, 2)
        XCTAssertEqual(viewModel.activeBlankIndex, 1)
        XCTAssertEqual(viewModel.phase, .playing)
        XCTAssertEqual(viewModel.mission?.meta.part, 6)
    }

    @MainActor
    func testSubmittingWrongAnswerCapturesSnapshotForArenaTelemetry() async {
        let service = StubArenaMissionService()
        let viewModel = ArenaMissionViewModel(service: service)

        await viewModel.loadMission(force: true)
        await viewModel.submitOption(service.mission.segments[0].task!.options[1])

        XCTAssertEqual(viewModel.answerStates[1]?.selectedText, "although")
        XCTAssertEqual(viewModel.answerStates[1]?.isCorrect, false)
        XCTAssertEqual(service.submittedAttempts.first?.part, 6)
        XCTAssertEqual(service.submittedAttempts.first?.snapshotPayload?.meta.targetWordBlankIndex, 1)
    }

    @MainActor
    func testCompletingMissionTransitionsIntoCompletedState() async {
        let service = StubArenaMissionService()
        let viewModel = ArenaMissionViewModel(service: service)

        await viewModel.loadMission(force: true)
        await viewModel.submitOption(service.mission.segments[0].task!.options[0])
        await viewModel.submitOption(service.mission.segments[1].task!.options[0])

        XCTAssertEqual(viewModel.phase, .completed)
        XCTAssertEqual(viewModel.summary?.answeredCount, 2)
        XCTAssertEqual(viewModel.summary?.correctCount, 2)
    }

    @MainActor
    func testRetryReloadsMissionAfterFailure() async {
        let service = StubArenaMissionService()
        service.failNextMissionLoad = true
        let viewModel = ArenaMissionViewModel(service: service)

        await viewModel.loadMission(force: true)
        XCTAssertEqual(viewModel.contentState, .error(
            title: "Mission 加载失败",
            message: "暂时无法拉取 Part 6 长文，请稍后重试。",
            actionTitle: "重试"
        ))

        await viewModel.retryMission()

        XCTAssertEqual(viewModel.phase, .playing)
        XCTAssertEqual(viewModel.questions.count, 2)
    }
}

@MainActor
private final class StubArenaMissionService: ArenaMissionServing {
    var failNextMissionLoad = false
    var mission = ArenaMissionPayload.fixture()
    var submittedAttempts: [ArenaMissionAttemptRequest] = []

    func fetchMission() async throws -> ArenaMissionPayload {
        if failNextMissionLoad {
            failNextMissionLoad = false
            throw StubError.loadFailed
        }

        return mission
    }

    func submitAttempt(_ request: ArenaMissionAttemptRequest) async throws -> ArenaMissionAttemptResponse {
        submittedAttempts.append(request)
        return ArenaMissionAttemptResponse(success: true, attemptId: "attempt-\(submittedAttempts.count)")
    }

    private enum StubError: Error {
        case loadFailed
    }
}

private extension ArenaMissionPayload {
    static func fixture() -> ArenaMissionPayload {
        ArenaMissionPayload(
            meta: ArenaMissionMeta(
                format: "part6",
                mode: "ARENA_PART6",
                batchSize: 1,
                systemPromptVersion: "v1",
                vocabID: 42,
                questionSeedID: "seed-part6",
                questionType: "GRAMMAR",
                part: 6,
                targetWordBlankIndex: nil
            ),
            segments: [
                ArenaMissionSegment(
                    type: "interaction",
                    contentMarkdown: nil,
                    task: ArenaMissionTask(
                        style: "bubble_select",
                        questionMarkdown: "Fill blank 1",
                        options: [
                            ArenaMissionOption(id: "A", text: "because", isCorrect: true),
                            ArenaMissionOption(id: "B", text: "although", isCorrect: false),
                        ],
                        answerKey: "because"
                    )
                ),
                ArenaMissionSegment(
                    type: "interaction",
                    contentMarkdown: nil,
                    task: ArenaMissionTask(
                        style: "bubble_select",
                        questionMarkdown: "Fill blank 2",
                        options: [
                            ArenaMissionOption(id: "A", text: "while", isCorrect: true),
                            ArenaMissionOption(id: "B", text: "however", isCorrect: false),
                        ],
                        answerKey: "while"
                    )
                ),
            ],
            passageMarkdown: """
            This is a long mission with [__BLANK_1__] one.

            Another paragraph reaches [__BLANK_2__] later.
            """
        )
    }
}
