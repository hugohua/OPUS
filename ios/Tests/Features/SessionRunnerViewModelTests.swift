import XCTest
@testable import OpusApp

final class SessionRunnerViewModelTests: XCTestCase {
    @MainActor
    func testIdentifiesPhraseDestinationBeforeSessionLoads() {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "PHRASE"),
                title: "短语卡组",
                subtitle: "移动端 Session Runner · PHRASE",
                cards: []
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "PHRASE"),
            service: service
        )

        XCTAssertTrue(viewModel.isPhraseDestination)
    }

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

    @MainActor
    func testPhraseRevealDoesNotSubmitUntilGradeIsSelected() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "PHRASE"),
                title: "短语训练",
                subtitle: "移动端 Session Runner · PHRASE",
                cards: [
                    SessionRunnerCard(
                        id: "phrase-1",
                        vocabID: 401,
                        mode: "PHRASE",
                        title: "initially",
                        prompt: "**initially** planned",
                        supportingText: "最初计划的",
                        detail: "1 / 1",
                        accent: .amber,
                        interaction: .phraseFlashcard(
                            SessionRunnerPhraseFlashcard(
                                phraseMarkdown: "**initially** planned",
                                translation: "最初计划的",
                                targetWord: "initially",
                                definition: "最初地",
                                phonetic: "ɪˈnɪʃəli",
                                userNote: nil,
                                fsrsPreview: nil
                            )
                        )
                    )
                ]
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "PHRASE"),
            service: service
        )

        await viewModel.load(force: true)
        XCTAssertFalse(viewModel.isAnswerRevealed)

        viewModel.revealAnswer()

        XCTAssertTrue(viewModel.isAnswerRevealed)
        XCTAssertTrue(service.submittedOutcomes.isEmpty)
    }

    @MainActor
    func testPhraseGradesSubmitFSRSRatingsAndResetRevealForNextCard() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "PHRASE"),
                title: "短语训练",
                subtitle: "移动端 Session Runner · PHRASE",
                cards: [
                    makePhraseCard(id: "phrase-1", vocabID: 501, word: "initially"),
                    makePhraseCard(id: "phrase-2", vocabID: 502, word: "additional"),
                    makePhraseCard(id: "phrase-3", vocabID: 503, word: "relevant"),
                    makePhraseCard(id: "phrase-4", vocabID: 504, word: "accurate")
                ]
            )
        )
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "PHRASE"),
            service: service
        )

        await viewModel.load(force: true)
        viewModel.revealAnswer()
        await viewModel.submitPhraseGrade(1)

        XCTAssertEqual(service.submittedOutcomes, [
            SessionRunnerOutcomeRequest(vocabID: 501, grade: 1, mode: "PHRASE")
        ])
        XCTAssertEqual(viewModel.currentCard?.title, "additional")
        XCTAssertFalse(viewModel.isAnswerRevealed)

        viewModel.revealAnswer()
        await viewModel.submitPhraseGrade(2)
        XCTAssertEqual(service.submittedOutcomes.map(\.grade), [1, 2])
        XCTAssertEqual(viewModel.currentCard?.title, "relevant")
        XCTAssertFalse(viewModel.isAnswerRevealed)

        viewModel.revealAnswer()
        await viewModel.submitPhraseGrade(3)
        XCTAssertEqual(service.submittedOutcomes.map(\.grade), [1, 2, 3])
        XCTAssertEqual(viewModel.currentCard?.title, "accurate")
        XCTAssertFalse(viewModel.isAnswerRevealed)

        viewModel.revealAnswer()
        await viewModel.submitPhraseGrade(4)
        XCTAssertEqual(service.submittedOutcomes.map(\.grade), [1, 2, 3, 4])
        XCTAssertTrue(viewModel.isCompleted)
    }

    @MainActor
    func testPhraseAudioUsesCleanPhraseMarkdownForTTS() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "PHRASE"),
                title: "短语训练",
                subtitle: "移动端 Session Runner · PHRASE",
                cards: [
                    makePhraseCard(id: "phrase-1", vocabID: 601, word: "initially")
                ]
            )
        )
        let ttsService = StubSessionRunnerTTSService()
        let audioPlayer = StubSessionRunnerAudioPlayer()
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "PHRASE"),
            service: service,
            ttsService: ttsService,
            audioPlayer: audioPlayer
        )

        await viewModel.load(force: true)
        await viewModel.playPhraseAudio()

        XCTAssertEqual(ttsService.requests, [
            DriveTTSRequest(text: "initially planned", voice: "Cherry", speed: 1)
        ])
        XCTAssertEqual(audioPlayer.playedURLs, [ttsService.result.audioURL])
    }

    @MainActor
    func testWordAudioUsesTargetWordForTTS() async {
        let service = StubSessionRunnerService(
            session: SessionRunnerSession(
                kind: .training(mode: "PHRASE"),
                title: "短语训练",
                subtitle: "移动端 Session Runner · PHRASE",
                cards: [
                    makePhraseCard(id: "phrase-1", vocabID: 701, word: "initially")
                ]
            )
        )
        let ttsService = StubSessionRunnerTTSService()
        let audioPlayer = StubSessionRunnerAudioPlayer()
        let viewModel = SessionRunnerViewModel(
            destination: .training(mode: "PHRASE"),
            service: service,
            ttsService: ttsService,
            audioPlayer: audioPlayer
        )

        await viewModel.load(force: true)
        await viewModel.playWordAudio()

        XCTAssertEqual(ttsService.requests, [
            DriveTTSRequest(text: "initially", voice: "Cherry", speed: 1)
        ])
        XCTAssertEqual(audioPlayer.playedURLs, [ttsService.result.audioURL])
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

@MainActor
private final class StubSessionRunnerTTSService: DriveTTSServing {
    let result = DriveTTSResult(
        audioURL: URL(string: "https://example.com/phrase-audio.mp3")!,
        cached: true,
        hash: "phrase-audio"
    )
    private(set) var requests: [DriveTTSRequest] = []

    func generateTTS(text: String, voice: String, speed: Double) async throws -> DriveTTSResult {
        requests.append(DriveTTSRequest(text: text, voice: voice, speed: speed))
        return result
    }
}

@MainActor
private final class StubSessionRunnerAudioPlayer: DriveAudioPlaying {
    private(set) var playedURLs: [URL] = []

    func play(url: URL, onEnded: @escaping @MainActor () async -> Void) {
        playedURLs.append(url)
    }

    func stop() {
    }
}

private func makePhraseCard(id: String, vocabID: Int, word: String) -> SessionRunnerCard {
    SessionRunnerCard(
        id: id,
        vocabID: vocabID,
        mode: "PHRASE",
        title: word,
        prompt: "**\(word)** planned",
        supportingText: "短语翻译",
        detail: "1 / 2",
        accent: .amber,
        interaction: .phraseFlashcard(
            SessionRunnerPhraseFlashcard(
                phraseMarkdown: "**\(word)** planned",
                translation: "短语翻译",
                targetWord: word,
                definition: "定义",
                phonetic: nil,
                userNote: nil,
                fsrsPreview: nil
            )
        )
    )
}
