import Foundation

enum SessionRunnerKind: Equatable {
    case training(mode: String)
    case reviewCards
    case audio
}

struct SessionRunnerChoiceOption: Equatable, Identifiable {
    let id: String
    let text: String
    let isCorrect: Bool
}

enum SessionRunnerInteraction: Equatable {
    case choice(options: [SessionRunnerChoiceOption], answerKey: String, explanation: String?)
    case grading
}

struct SessionRunnerCard: Equatable, Identifiable {
    let id: String
    let vocabID: Int
    let mode: String
    let title: String
    let prompt: String
    let supportingText: String
    let detail: String
    let accent: DashboardAccent
    let interaction: SessionRunnerInteraction

    init(
        id: String,
        vocabID: Int,
        mode: String,
        title: String,
        prompt: String,
        supportingText: String,
        detail: String,
        accent: DashboardAccent,
        interaction: SessionRunnerInteraction = .grading
    ) {
        self.id = id
        self.vocabID = vocabID
        self.mode = mode
        self.title = title
        self.prompt = prompt
        self.supportingText = supportingText
        self.detail = detail
        self.accent = accent
        self.interaction = interaction
    }
}

struct SessionRunnerSession: Equatable {
    let kind: SessionRunnerKind
    let title: String
    let subtitle: String
    let cards: [SessionRunnerCard]
}

struct SessionRunnerOutcomeRequest: Equatable {
    let vocabID: Int
    let grade: Int
    let mode: String
}

struct SessionRunnerAudioGradeRequest: Equatable {
    let vocabID: Int
    let grade: Int
}

