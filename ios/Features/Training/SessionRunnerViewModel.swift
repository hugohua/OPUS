import Foundation
import Observation

@MainActor
@Observable
final class SessionRunnerViewModel {
    enum AnswerState: Equatable {
        case idle
        case resolved(selectedID: String, isCorrect: Bool, grade: Int)
    }

    let destination: DashboardDestination
    var contentState: OpusContentState = .loading
    var session: SessionRunnerSession?
    var currentIndex: Int = 0
    var isCompleted = false
    var answerState: AnswerState = .idle
    var inlineErrorMessage: String?

    @ObservationIgnored private let service: SessionRunnerServing
    @ObservationIgnored private var hasLoaded = false

    init(destination: DashboardDestination, service: SessionRunnerServing) {
        self.destination = destination
        self.service = service
    }

    var sessionTitle: String {
        session?.title ?? "训练会话"
    }

    var sessionSubtitle: String {
        session?.subtitle ?? ""
    }

    var currentCard: SessionRunnerCard? {
        guard let session, session.cards.indices.contains(currentIndex) else { return nil }
        return session.cards[currentIndex]
    }

    var progressText: String {
        guard let session else { return "0 / 0" }
        if session.cards.isEmpty { return "0 / 0" }
        return "\(min(currentIndex + 1, session.cards.count)) / \(session.cards.count)"
    }

    func load(force: Bool = false) async {
        if hasLoaded && !force { return }
        contentState = .loading
        inlineErrorMessage = nil
        isCompleted = false
        currentIndex = 0
        answerState = .idle

        do {
            let nextSession = try await service.fetchSession(for: destination)
            session = nextSession
            hasLoaded = true
            if nextSession.cards.isEmpty {
                contentState = .empty(
                    title: "当前没有可用训练",
                    message: "这一轮暂时没有可消费的题目，请稍后再试。"
                )
            } else {
                contentState = .empty(title: "", message: "")
            }
        } catch {
            contentState = .error(
                title: "训练会话加载失败",
                message: "暂时无法拉取本轮题目，请稍后重试。",
                actionTitle: "重试"
            )
        }
    }

    func submit(grade: Int) async {
        guard let card = currentCard else { return }

        do {
            inlineErrorMessage = nil
            switch session?.kind {
            case .audio:
                try await service.submitAudioGrade(
                    SessionRunnerAudioGradeRequest(vocabID: card.vocabID, grade: grade)
                )
            case .reviewCards, .training:
                try await service.submitOutcome(
                    SessionRunnerOutcomeRequest(vocabID: card.vocabID, grade: grade, mode: card.mode)
                )
            case nil:
                return
            }

            advance()
        } catch {
            inlineErrorMessage = "本题结果提交失败，请重试。"
        }
    }

    func selectOption(_ option: SessionRunnerChoiceOption) {
        guard case .idle = answerState else { return }
        answerState = .resolved(
            selectedID: option.id,
            isCorrect: option.isCorrect,
            grade: option.isCorrect ? 3 : 1
        )
    }

    func submitResolvedAnswer() async {
        guard case .resolved(_, _, let grade) = answerState else { return }
        await submit(grade: grade)
    }

    func resetForSessionChange() {
        contentState = .loading
        session = nil
        currentIndex = 0
        isCompleted = false
        answerState = .idle
        inlineErrorMessage = nil
        hasLoaded = false
    }

    private func advance() {
        answerState = .idle
        if let session, currentIndex < session.cards.count - 1 {
            currentIndex += 1
        } else {
            isCompleted = true
        }
    }
}

