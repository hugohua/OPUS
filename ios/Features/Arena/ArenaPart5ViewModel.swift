import Foundation
import Observation

@MainActor
@Observable
final class ArenaPart5ViewModel {
    enum Phase: Equatable {
        case loading
        case playing
        case completed
    }

    enum AnswerState: Equatable {
        case idle
        case answered(selectedOptionID: String, isCorrect: Bool, correctOptionID: String?)
    }

    let grammarNodeID: String?
    var contentState: OpusContentState = .loading
    var phase: Phase = .loading
    var questions: [ArenaPart5Question] = []
    var currentIndex = 0
    var answerState: AnswerState = .idle
    var isExplanationPresented = false
    var summary = ArenaPart5Summary(answeredCount: 0, correctCount: 0, incorrectCount: 0)
    var inlineErrorMessage: String?

    @ObservationIgnored private let service: ArenaPart5Serving
    @ObservationIgnored private var hasLoaded = false
    @ObservationIgnored private var questionStartTime = Date()
    @ObservationIgnored private var answeredQuestionIDs: Set<String> = []

    init(grammarNodeID: String?, service: ArenaPart5Serving) {
        self.grammarNodeID = grammarNodeID
        self.service = service
    }

    var currentQuestion: ArenaPart5Question? {
        guard questions.indices.contains(currentIndex) else { return nil }
        return questions[currentIndex]
    }

    var progressText: String {
        guard !questions.isEmpty else { return "0 / 0" }
        return "\(min(currentIndex + 1, questions.count)) / \(questions.count)"
    }

    var currentExplanation: String? {
        currentQuestion?.explanation
    }

    var title: String {
        grammarNodeID == nil ? "Part 5 单句闪电战" : "Part 5 定向训练"
    }

    func load(force: Bool = false) async {
        if hasLoaded && !force { return }

        contentState = .loading
        phase = .loading
        inlineErrorMessage = nil
        resetRunState()

        do {
            questions = try await service.fetchQuestions(
                ArenaPart5FetchRequest(grammarNodeID: grammarNodeID, limit: 10)
            )
            hasLoaded = true

            if questions.isEmpty {
                contentState = .empty(
                    title: "Part 5 暂无题目",
                    message: "当前没有可用的单句竞技题，请稍后再试。"
                )
                return
            }

            contentState = .empty(title: "", message: "")
            phase = .playing
            questionStartTime = Date()
        } catch {
            contentState = .error(
                title: "Part 5 加载失败",
                message: "暂时无法拉取单句竞技题，请稍后重试。",
                actionTitle: "重试"
            )
        }
    }

    func retry() async {
        hasLoaded = false
        await load(force: true)
    }

    func submitOption(_ option: ArenaPart5Option) async {
        guard phase == .playing,
              let question = currentQuestion,
              case .idle = answerState
        else {
            return
        }

        answerState = .answered(
            selectedOptionID: option.id,
            isCorrect: option.isCorrect,
            correctOptionID: question.correctOptionID
        )
        answeredQuestionIDs.insert(question.id)
        updateSummary()
        inlineErrorMessage = nil

        let grade = option.isCorrect ? 3 : 1
        let outcomeRequest = SessionRunnerOutcomeRequest(
            vocabID: question.vocabID,
            grade: grade,
            mode: question.mode
        )
        let attemptRequest = buildAttemptRequest(question: question, option: option)

        do {
            try await service.submitOutcome(outcomeRequest)
        } catch {
            inlineErrorMessage = "FSRS 结果提交失败，后端会继续遵守纯语法题 skip 规则。"
        }

        do {
            _ = try await service.submitAttempt(attemptRequest)
        } catch {
            inlineErrorMessage = [inlineErrorMessage, "Arena telemetry 提交失败。"]
                .compactMap { $0 }
                .joined(separator: " ")
        }
    }

    func showExplanation() {
        guard currentExplanation != nil else { return }
        isExplanationPresented = true
    }

    func hideExplanation() {
        isExplanationPresented = false
    }

    func goToNextQuestion() {
        guard phase == .playing else { return }

        isExplanationPresented = false
        answerState = .idle

        if currentIndex < questions.count - 1 {
            currentIndex += 1
            questionStartTime = Date()
        } else {
            phase = .completed
        }
    }

    private func resetRunState() {
        questions = []
        currentIndex = 0
        answerState = .idle
        isExplanationPresented = false
        summary = ArenaPart5Summary(answeredCount: 0, correctCount: 0, incorrectCount: 0)
        answeredQuestionIDs = []
    }

    private func updateSummary() {
        let correctCount = questions
            .filter { answeredQuestionIDs.contains($0.id) }
            .filter { question in
                guard case .answered(let selectedOptionID, let isCorrect, _) = answerState,
                      currentQuestion?.id == question.id
                else {
                    return false
                }
                return question.options.contains(where: { $0.id == selectedOptionID }) && isCorrect
            }
            .count

        let priorCorrectCount = summary.correctCount
        let nextCorrectCount: Int
        if case .answered(_, let isCorrect, _) = answerState {
            nextCorrectCount = priorCorrectCount + (isCorrect ? 1 : 0)
        } else {
            nextCorrectCount = priorCorrectCount
        }

        let answeredCount = answeredQuestionIDs.count
        summary = ArenaPart5Summary(
            answeredCount: answeredCount,
            correctCount: max(nextCorrectCount, correctCount),
            incorrectCount: answeredCount - max(nextCorrectCount, correctCount)
        )
    }

    private func buildAttemptRequest(
        question: ArenaPart5Question,
        option: ArenaPart5Option
    ) -> ArenaPart5AttemptRequest {
        ArenaPart5AttemptRequest(
            questionSeedId: question.questionSeedID,
            anchorVocabId: question.vocabID,
            grammarNodeId: grammarNodeID ?? question.grammarNodeID,
            isCorrect: option.isCorrect,
            responseTimeMs: max(Int(Date().timeIntervalSince(questionStartTime) * 1000), 0),
            selectedOption: option.text,
            questionType: question.questionType,
            part: 5
        )
    }
}
