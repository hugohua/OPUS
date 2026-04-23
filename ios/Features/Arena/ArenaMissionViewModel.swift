import Foundation
import Observation

@MainActor
@Observable
final class ArenaMissionViewModel {
    enum Phase: Equatable {
        case loading
        case playing
        case completed
    }

    var contentState: OpusContentState = .loading
    var phase: Phase = .loading
    var mission: ArenaMissionPayload?
    var questions: [ArenaMissionQuestion] = []
    var answerStates: [Int: ArenaMissionAnswerState] = [:]
    var activeBlankIndex: Int?
    var summary: ArenaMissionSummary?
    var submissionErrorMessage: String?

    @ObservationIgnored private let service: ArenaMissionServing
    @ObservationIgnored private var hasLoadedMission = false
    @ObservationIgnored private var blankStartTimes: [Int: Date] = [:]

    init(service: ArenaMissionServing) {
        self.service = service
    }

    var currentQuestion: ArenaMissionQuestion? {
        guard let activeBlankIndex else { return nil }
        return questions.first(where: { $0.blankIndex == activeBlankIndex })
    }

    var isCurrentBlankAnswered: Bool {
        guard let activeBlankIndex else { return false }
        return answerStates[activeBlankIndex] != nil
    }

    var remainingUnansweredCount: Int {
        max(questions.count - answerStates.count, 0)
    }

    var passageFragments: [ArenaMissionPassageFragment] {
        mission?.passageFragments ?? []
    }

    func loadMission(force: Bool = false) async {
        if hasLoadedMission && !force { return }

        contentState = .loading
        phase = .loading
        submissionErrorMessage = nil

        do {
            let payload = try await service.fetchMission()
            configure(with: payload)
            hasLoadedMission = true
        } catch {
            contentState = .error(
                title: "Mission 加载失败",
                message: "暂时无法拉取 Part 6 长文，请稍后重试。",
                actionTitle: "重试"
            )
        }
    }

    func retryMission() async {
        reset()
        await loadMission(force: true)
    }

    func reset() {
        contentState = .loading
        phase = .loading
        mission = nil
        questions = []
        answerStates = [:]
        activeBlankIndex = nil
        summary = nil
        submissionErrorMessage = nil
        blankStartTimes = [:]
        hasLoadedMission = false
    }

    func selectBlank(_ blankIndex: Int) {
        guard questions.contains(where: { $0.blankIndex == blankIndex }) else { return }
        activeBlankIndex = blankIndex
        blankStartTimes[blankIndex] = blankStartTimes[blankIndex] ?? Date()
    }

    func goToPreviousBlank() {
        guard let activeBlankIndex else { return }
        selectBlank(max(1, activeBlankIndex - 1))
    }

    func goToNextBlank() {
        guard let activeBlankIndex else { return }
        selectBlank(min(questions.count, activeBlankIndex + 1))
    }

    func continueFromCurrentBlank() {
        if phase == .completed {
            return
        }

        if let nextBlank = nextUnansweredBlankIndex(after: activeBlankIndex ?? 0) ?? firstUnansweredBlankIndex() {
            selectBlank(nextBlank)
        }
    }

    func submitOption(_ option: ArenaMissionOption) async {
        guard phase == .playing,
              let payload = mission,
              let question = currentQuestion,
              answerStates[question.blankIndex] == nil
        else {
            return
        }

        let request = buildAttemptRequest(
            mission: payload,
            question: question,
            option: option
        )

        var answerState = ArenaMissionAnswerState(
            optionID: option.id,
            selectedText: option.text,
            isCorrect: option.isCorrect,
            attemptID: nil
        )
        answerStates[question.blankIndex] = answerState
        submissionErrorMessage = nil

        do {
            let response = try await service.submitAttempt(request)
            answerState = answerState.withAttemptID(response.attemptId)
            answerStates[question.blankIndex] = answerState
        } catch {
            submissionErrorMessage = "遥测提交失败，但本题结果已保留在当前 Mission。"
        }

        updateSummary()
        if answerStates.count == questions.count {
            phase = .completed
            activeBlankIndex = nil
        } else if let nextBlank = nextUnansweredBlankIndex(after: question.blankIndex) ?? firstUnansweredBlankIndex() {
            selectBlank(nextBlank)
        }
    }

    func blankLabel(for blankIndex: Int) -> String {
        if let answer = answerStates[blankIndex] {
            return answer.selectedText
        }

        return String(130 + blankIndex)
    }

    func blankAccent(for blankIndex: Int) -> DashboardAccent {
        if let answer = answerStates[blankIndex] {
            return answer.isCorrect ? .emerald : .amber
        }

        return activeBlankIndex == blankIndex ? .indigo : .slate
    }

    private func configure(with payload: ArenaMissionPayload) {
        mission = payload
        questions = payload.questions
        answerStates = [:]
        summary = ArenaMissionSummary(answeredCount: 0, correctCount: 0, incorrectCount: 0)
        submissionErrorMessage = nil
        blankStartTimes = [:]
        phase = .playing
        contentState = .empty(title: "", message: "")
        activeBlankIndex = questions.first?.blankIndex

        if let activeBlankIndex {
            blankStartTimes[activeBlankIndex] = Date()
        }
    }

    private func updateSummary() {
        let answeredCount = answerStates.count
        let correctCount = answerStates.values.filter(\.isCorrect).count
        summary = ArenaMissionSummary(
            answeredCount: answeredCount,
            correctCount: correctCount,
            incorrectCount: answeredCount - correctCount
        )
    }

    private func firstUnansweredBlankIndex() -> Int? {
        questions.first(where: { answerStates[$0.blankIndex] == nil })?.blankIndex
    }

    private func nextUnansweredBlankIndex(after blankIndex: Int) -> Int? {
        questions
            .map(\.blankIndex)
            .filter { answerStates[$0] == nil }
            .first(where: { $0 > blankIndex })
    }

    private func buildAttemptRequest(
        mission: ArenaMissionPayload,
        question: ArenaMissionQuestion,
        option: ArenaMissionOption
    ) -> ArenaMissionAttemptRequest {
        let startTime = blankStartTimes[question.blankIndex] ?? Date()
        let responseTimeMs = max(Int(Date().timeIntervalSince(startTime) * 1000), 0)
        let part = mission.meta.part ?? 6
        let questionSeedId = mission.meta.questionSeedID.map { "\($0)-\(question.blankIndex)" }
            ?? "p6-fallback-\(UUID().uuidString)-\(question.blankIndex)"

        return ArenaMissionAttemptRequest(
            questionSeedId: questionSeedId,
            anchorVocabId: mission.meta.vocabID,
            isCorrect: option.isCorrect,
            responseTimeMs: responseTimeMs,
            selectedOption: option.text,
            questionType: mission.meta.questionType ?? "GRAMMAR",
            part: part,
            snapshotPayload: option.isCorrect
                ? nil
                : mission.snapshotPayload(targetWordBlankIndex: question.blankIndex)
        )
    }
}
