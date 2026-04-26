import Foundation
import XCTest
@testable import OpusApp

@MainActor
final class DrivePlayerViewModelTests: XCTestCase {
    func testQuizPlaybackAdvancesThroughWordPhraseMeaningAndLoops() async {
        let ttsService = FakeDriveTTSService()
        let audioPlayer = FakeDriveAudioPlayer()
        let viewModel = DrivePlayerViewModel(
            playlistService: FakeDrivePlaylistService(items: [
                .quiz,
                .wash
            ]),
            ttsService: ttsService,
            audioPlayer: audioPlayer
        )

        await viewModel.load()
        await viewModel.play()

        XCTAssertEqual(viewModel.playbackStage, .word)
        XCTAssertEqual(ttsService.requests.map(\.text), ["audit"])

        await audioPlayer.finish()
        XCTAssertEqual(viewModel.playbackStage, .phrase)
        XCTAssertEqual(ttsService.requests.map(\.text), ["audit", "conduct an audit"])

        await audioPlayer.finish()
        XCTAssertEqual(viewModel.playbackStage, .meaning)
        XCTAssertEqual(ttsService.requests.map(\.text), ["audit", "conduct an audit", "审计"])

        await audioPlayer.finish()
        XCTAssertEqual(viewModel.currentIndex, 1)
        XCTAssertEqual(viewModel.playbackStage, .word)
        XCTAssertEqual(ttsService.requests.last?.text, "annual report")
    }

    func testPauseStopsCurrentAudioWithoutChangingPlaylistPosition() async {
        let audioPlayer = FakeDriveAudioPlayer()
        let viewModel = DrivePlayerViewModel(
            playlistService: FakeDrivePlaylistService(items: [.quiz]),
            ttsService: FakeDriveTTSService(),
            audioPlayer: audioPlayer
        )

        await viewModel.load()
        await viewModel.play()
        audioPlayer.stopCallCount = 0
        viewModel.pause()

        XCTAssertFalse(viewModel.isPlaying)
        XCTAssertEqual(viewModel.currentIndex, 0)
        XCTAssertEqual(audioPlayer.stopCallCount, 1)
    }

    func testNextAndPreviousWrapAroundPlaylist() async {
        let viewModel = DrivePlayerViewModel(
            playlistService: FakeDrivePlaylistService(items: [.quiz, .wash]),
            ttsService: FakeDriveTTSService(),
            audioPlayer: FakeDriveAudioPlayer()
        )

        await viewModel.load()

        await viewModel.previous()
        XCTAssertEqual(viewModel.currentIndex, 1)

        await viewModel.next()
        XCTAssertEqual(viewModel.currentIndex, 0)
    }

    func testTTSErrorSkipsFailedSliceAndContinuesSequence() async {
        let ttsService = FakeDriveTTSService(failingTexts: ["audit"])
        let viewModel = DrivePlayerViewModel(
            playlistService: FakeDrivePlaylistService(items: [.quiz]),
            ttsService: ttsService,
            audioPlayer: FakeDriveAudioPlayer()
        )

        await viewModel.load()
        await viewModel.play()

        XCTAssertEqual(viewModel.playbackStage, .phrase)
        XCTAssertEqual(ttsService.requests.map(\.text), ["audit", "conduct an audit"])
        XCTAssertEqual(viewModel.inlineErrorMessage, "音频生成失败，已跳过当前片段。")
    }

    func testSingleSliceTTSErrorPausesInsteadOfLoopingSameItem() async {
        let ttsService = OneShotFailingDriveTTSService(failingText: "annual report")
        let viewModel = DrivePlayerViewModel(
            playlistService: FakeDrivePlaylistService(items: [.wash]),
            ttsService: ttsService,
            audioPlayer: FakeDriveAudioPlayer()
        )

        await viewModel.load()
        await viewModel.play()

        XCTAssertFalse(viewModel.isPlaying)
        XCTAssertEqual(ttsService.requests.map(\.text), ["annual report"])
        XCTAssertEqual(viewModel.inlineErrorMessage, "音频生成失败，已跳过当前片段。")
    }
}

private struct FakeDrivePlaylistService: DrivePlaylistServing {
    let items: [DriveItem]

    func fetchPlaylist(mode: String, track: String, batchSize: Int) async throws -> DrivePlaylist {
        DrivePlaylist(mode: mode, track: track, batchSize: batchSize, items: items)
    }
}

private final class FakeDriveTTSService: DriveTTSServing {
    let failingTexts: Set<String>
    private(set) var requests: [DriveTTSRequest] = []

    init(failingTexts: Set<String> = []) {
        self.failingTexts = failingTexts
    }

    func generateTTS(text: String, voice: String, speed: Double) async throws -> DriveTTSResult {
        requests.append(DriveTTSRequest(text: text, voice: voice, speed: speed))
        if failingTexts.contains(text) {
            throw FakeDriveError.tts
        }
        return DriveTTSResult(audioURL: URL(string: "http://localhost:3000/audio/\(text).wav")!, cached: true, hash: text)
    }
}

private final class FakeDriveAudioPlayer: DriveAudioPlaying {
    var stopCallCount = 0
    private var onEnded: (@MainActor () async -> Void)?

    func play(url: URL, onEnded: @escaping @MainActor () async -> Void) {
        self.onEnded = onEnded
    }

    func stop() {
        stopCallCount += 1
        onEnded = nil
    }

    func finish() async {
        await onEnded?()
    }
}

private final class OneShotFailingDriveTTSService: DriveTTSServing {
    let failingText: String
    private(set) var requests: [DriveTTSRequest] = []

    init(failingText: String) {
        self.failingText = failingText
    }

    func generateTTS(text: String, voice: String, speed: Double) async throws -> DriveTTSResult {
        requests.append(DriveTTSRequest(text: text, voice: voice, speed: speed))
        if text == failingText {
            throw FakeDriveError.tts
        }
        return DriveTTSResult(audioURL: URL(string: "http://localhost:3000/audio/\(text).wav")!, cached: true, hash: text)
    }
}

private enum FakeDriveError: Error {
    case tts
}

private extension DriveItem {
    static let quiz = DriveItem(
        id: "1",
        text: "audit",
        trans: "审计",
        phonetic: "/ˈɔːdɪt/",
        ttsPhrase: "conduct an audit",
        word: "audit",
        pos: "n.",
        meaning: "审计",
        mode: "QUIZ",
        voice: "Kai",
        speed: 0.9
    )

    static let wash = DriveItem(
        id: "2",
        text: "annual report",
        trans: "年度报告",
        phonetic: "",
        ttsPhrase: "annual report",
        word: "report",
        pos: "phrase",
        meaning: "报告",
        mode: "WASH",
        voice: "Cherry",
        speed: 0.9
    )
}
