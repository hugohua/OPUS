import XCTest
@testable import OpusApp

final class ArenaPart5ViewModelTests: XCTestCase {
    @MainActor
    func testLoadsQuestionBatch() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: nil, service: service)

        await viewModel.load(force: true)

        XCTAssertEqual(service.fetchRequests, [
            ArenaPart5FetchRequest(grammarNodeID: nil, limit: 10)
        ])
        XCTAssertEqual(viewModel.phase, .playing)
        XCTAssertEqual(viewModel.currentQuestion?.prompt, "The report ___ by noon.")
        XCTAssertEqual(viewModel.progressText, "1 / 2")
    }

    @MainActor
    func testSubmittingAnswerShowsCorrectnessFeedbackAndSeparatesOutcomeFromArenaTelemetry() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: nil, service: service)

        await viewModel.load(force: true)
        await viewModel.submitOption(service.questions[0].options[1])

        XCTAssertEqual(viewModel.answerState, .answered(
            selectedOptionID: "B",
            isCorrect: false,
            correctOptionID: "A"
        ))
        XCTAssertEqual(service.submittedOutcomes, [
            SessionRunnerOutcomeRequest(vocabID: 101, grade: 1, mode: "ARENA_PART5")
        ])
        XCTAssertEqual(service.submittedAttempts.count, 1)
        XCTAssertEqual(service.submittedAttempts.first?.anchorVocabId, 101)
        XCTAssertEqual(service.submittedAttempts.first?.isCorrect, false)
        XCTAssertEqual(service.submittedAttempts.first?.selectedOption, "has filed")
        XCTAssertEqual(service.submittedAttempts.first?.questionType, "GRAMMAR")
        XCTAssertEqual(service.submittedAttempts.first?.part, 5)
    }

    @MainActor
    func testExplanationDrawerStateTogglesAfterAnswer() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: nil, service: service)

        await viewModel.load(force: true)
        await viewModel.submitOption(service.questions[0].options[0])
        viewModel.showExplanation()

        XCTAssertTrue(viewModel.isExplanationPresented)
        XCTAssertEqual(viewModel.currentExplanation, "Use present perfect passive.")

        viewModel.hideExplanation()

        XCTAssertFalse(viewModel.isExplanationPresented)
    }

    @MainActor
    func testNextQuestionTransitionResetsFeedback() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: nil, service: service)

        await viewModel.load(force: true)
        await viewModel.submitOption(service.questions[0].options[0])
        viewModel.showExplanation()
        viewModel.goToNextQuestion()

        XCTAssertEqual(viewModel.currentQuestion?.id, "p5-2")
        XCTAssertEqual(viewModel.progressText, "2 / 2")
        XCTAssertEqual(viewModel.answerState, .idle)
        XCTAssertFalse(viewModel.isExplanationPresented)
    }

    @MainActor
    func testCompletionAfterFinalQuestion() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: nil, service: service)

        await viewModel.load(force: true)
        await viewModel.submitOption(service.questions[0].options[0])
        viewModel.goToNextQuestion()
        await viewModel.submitOption(service.questions[1].options[1])
        viewModel.goToNextQuestion()

        XCTAssertEqual(viewModel.phase, .completed)
        XCTAssertEqual(viewModel.summary, ArenaPart5Summary(answeredCount: 2, correctCount: 2, incorrectCount: 0))
        XCTAssertEqual(service.submittedOutcomes.last, SessionRunnerOutcomeRequest(vocabID: -7, grade: 3, mode: "ARENA_PART5"))
    }

    @MainActor
    func testTargetedGrammarNodeIDFlowPassesGrammarNodeToBatchAndTelemetry() async {
        let service = StubArenaPart5Service()
        let viewModel = ArenaPart5ViewModel(grammarNodeID: "GRAMMAR_NODE_42", service: service)

        await viewModel.load(force: true)
        await viewModel.submitOption(service.questions[0].options[0])

        XCTAssertEqual(service.fetchRequests, [
            ArenaPart5FetchRequest(grammarNodeID: "GRAMMAR_NODE_42", limit: 10)
        ])
        XCTAssertEqual(service.submittedAttempts.first?.grammarNodeId, "GRAMMAR_NODE_42")
    }
}

@MainActor
private final class StubArenaPart5Service: ArenaPart5Serving {
    var questions: [ArenaPart5Question] = ArenaPart5Question.fixtureBatch()
    var fetchRequests: [ArenaPart5FetchRequest] = []
    var submittedOutcomes: [SessionRunnerOutcomeRequest] = []
    var submittedAttempts: [ArenaPart5AttemptRequest] = []

    func fetchQuestions(_ request: ArenaPart5FetchRequest) async throws -> [ArenaPart5Question] {
        fetchRequests.append(request)
        return questions
    }

    func submitOutcome(_ request: SessionRunnerOutcomeRequest) async throws {
        submittedOutcomes.append(request)
    }

    func submitAttempt(_ request: ArenaPart5AttemptRequest) async throws -> ArenaPart5AttemptResponse {
        submittedAttempts.append(request)
        return ArenaPart5AttemptResponse(success: true, attemptId: "attempt-\(submittedAttempts.count)")
    }
}

private extension ArenaPart5Question {
    static func fixtureBatch() -> [ArenaPart5Question] {
        [
            ArenaPart5Question(
                id: "p5-1",
                vocabID: 101,
                mode: "ARENA_PART5",
                prompt: "The report ___ by noon.",
                stem: "Choose the best completion.",
                options: [
                    ArenaPart5Option(id: "A", text: "has been filed", isCorrect: true),
                    ArenaPart5Option(id: "B", text: "has filed", isCorrect: false),
                ],
                explanation: "Use present perfect passive.",
                questionSeedID: "seed-1",
                questionType: "GRAMMAR",
                grammarNodeID: nil
            ),
            ArenaPart5Question(
                id: "p5-2",
                vocabID: -7,
                mode: "ARENA_PART5",
                prompt: "Neither answer ___ convincing.",
                stem: "Choose the verb form.",
                options: [
                    ArenaPart5Option(id: "A", text: "are", isCorrect: false),
                    ArenaPart5Option(id: "B", text: "is", isCorrect: true),
                ],
                explanation: "Neither takes a singular verb here.",
                questionSeedID: "seed-2",
                questionType: "GRAMMAR",
                grammarNodeID: "GRAMMAR_NODE_42"
            ),
        ]
    }
}
