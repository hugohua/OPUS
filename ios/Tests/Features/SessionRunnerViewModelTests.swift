import XCTest
@testable import OpusApp

final class SessionRunnerViewModelTests: XCTestCase {
    @MainActor
    func testLoadsTrainingModeBatchFromService() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "SYNTAX"),
                title: "语法训练",
                subtitle: "今日推荐",
                cards: [
                    SessionRunnerCard(
                        id: "batch-1",
                        vocabID: 101,
                        mode: "SYNTAX",
                        title: "audit",
                        prompt: "Choose the best completion for the sentence.",
                        supportingText: "The team will ___ the report tomorrow.",
                        detail: "1 / 2",
                        accent: .violet
                    ),
                    SessionRunnerCard(
                        id: "batch-2",
                        vocabID: 102,
                        mode: "SYNTAX",
                        title: "budget",
                        prompt: "Fill in the blank.",
                        supportingText: "We need to revise the yearly ___.",
                        detail: "2 / 2",
                        accent: .violet
                    )
                ]
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "SYNTAX"),
            service: service
        )

        await viewModel.load(force: true)

        XCTAssertEqual(viewModel.sessionTitle, "语法训练")
        XCTAssertEqual(viewModel.currentCard?.title, "audit")
        XCTAssertEqual(viewModel.progressText, "1 / 2")
    }

    @MainActor
    func testSubmitsOutcomeAndAdvancesReviewCards() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .reviewCards,
                title: "复习卡组",
                subtitle: "到期优先",
                cards: [
                    SessionRunnerCard(
                        id: "review-1",
                        vocabID: 201,
                        mode: "SYNTAX",
                        title: "audit",
                        prompt: "审计",
                        supportingText: "Visual review",
                        detail: "1 / 2",
                        accent: .emerald
                    ),
                    SessionRunnerCard(
                        id: "review-2",
                        vocabID: 202,
                        mode: "SYNTAX",
                        title: "invoice",
                        prompt: "发票",
                        supportingText: "Visual review",
                        detail: "2 / 2",
                        accent: .emerald
                    )
                ]
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .reviewCards,
            service: service
        )

        await viewModel.load(force: true)
        await viewModel.submit(grade: 3)

        XCTAssertEqual(service.submittedOutcomes, [
            SessionRunnerOutcomeRequest(vocabID: 201, grade: 3, mode: "SYNTAX")
        ])
        XCTAssertEqual(viewModel.currentCard?.title, "invoice")
        XCTAssertEqual(viewModel.progressText, "2 / 2")
    }

    @MainActor
    func testUsesAudioGradeEndpointForAudioSessions() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .audio,
                title: "听力训练",
                subtitle: "Audio queue",
                cards: [
                    SessionRunnerCard(
                        id: "audio-1",
                        vocabID: 301,
                        mode: "AUDIO",
                        title: "abroad",
                        prompt: "Listen and grade your recall.",
                        supportingText: "əˈbrɔːd",
                        detail: "1 / 1",
                        accent: .amber
                    )
                ]
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .audio,
            service: service
        )

        await viewModel.load(force: true)
        await viewModel.submit(grade: 4)

        XCTAssertEqual(service.submittedAudioGrades, [
            SessionRunnerAudioGradeRequest(vocabID: 301, grade: 4)
        ])
        XCTAssertTrue(viewModel.isCompleted)
    }
}

@MainActor
private final class StubSessionRunnerService: SessionRunnerServing {
    let session: SessionRunnerSession
    var submittedOutcomes: [SessionRunnerOutcomeRequest] = []
    var submittedAudioGrades: [SessionRunnerAudioGradeRequest] = []

    init(session: SessionRunnerSession) {
        self.session = session
    }

    func fetchSession(for destination: DashboardDestination) async throws -> SessionRunnerSession {
        session
    }

    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws {
        submittedOutcomes.append(request)
    }

    func submitAudioGrade(_ request: SessionRunnerAudioGradeRequest) async throws {
        submittedAudioGrades.append(request)
    }
}
