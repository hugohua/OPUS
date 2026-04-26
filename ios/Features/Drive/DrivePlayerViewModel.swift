import AVFoundation
import Foundation
import Observation

@MainActor
protocol DriveAudioPlaying: AnyObject {
    func play(url: URL, onEnded: @escaping @MainActor () async -> Void)
    func stop()
}

@MainActor
final class DriveAudioPlayer: NSObject, DriveAudioPlaying {
    private var player: AVPlayer?
    private var onEnded: (@MainActor () async -> Void)?
    private var endObserver: NSObjectProtocol?

    func play(url: URL, onEnded: @escaping @MainActor () async -> Void) {
        stop()
        self.onEnded = onEnded

        let player = AVPlayer(url: url)
        self.player = player
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player.currentItem,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                await self?.onEnded?()
            }
        }
        player.play()
    }

    func stop() {
        player?.pause()
        player = nil
        onEnded = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }
}

@MainActor
@Observable
final class DrivePlayerViewModel {
    let mode: String
    let track: String
    let batchSize: Int
    var contentState: OpusContentState = .loading
    var playlist: DrivePlaylist?
    var currentIndex = 0
    var isPlaying = false
    var playbackStage: DrivePlaybackStage = .idle
    var inlineErrorMessage: String?

    @ObservationIgnored private let playlistService: DrivePlaylistServing
    @ObservationIgnored private let ttsService: DriveTTSServing
    @ObservationIgnored private let audioPlayer: DriveAudioPlaying
    @ObservationIgnored private var hasLoaded = false

    init(
        mode: String = "SANDWICH",
        track: String = "VISUAL",
        batchSize: Int = 50,
        playlistService: DrivePlaylistServing,
        ttsService: DriveTTSServing,
        audioPlayer: DriveAudioPlaying
    ) {
        self.mode = mode
        self.track = track
        self.batchSize = batchSize
        self.playlistService = playlistService
        self.ttsService = ttsService
        self.audioPlayer = audioPlayer
    }

    var items: [DriveItem] {
        playlist?.items ?? []
    }

    var currentItem: DriveItem? {
        guard items.indices.contains(currentIndex) else { return nil }
        return items[currentIndex]
    }

    var progressText: String {
        guard !items.isEmpty else { return "0 / 0" }
        return "\(currentIndex + 1) / \(items.count)"
    }

    var modeTitle: String {
        switch mode {
        case "SRS_FOCUS":
            return "SRS 专攻"
        case "WEAK_REPAIR":
            return "弱项修复"
        case "IMMERSE":
            return "沉浸听力"
        case "DISCOVERY":
            return "新词探索"
        default:
            return "听力驾驶"
        }
    }

    func load(force: Bool = false) async {
        if hasLoaded && !force { return }
        contentState = .loading
        inlineErrorMessage = nil
        playbackStage = .idle
        currentIndex = 0
        isPlaying = false
        audioPlayer.stop()

        do {
            let nextPlaylist = try await playlistService.fetchPlaylist(mode: mode, track: track, batchSize: batchSize)
            playlist = nextPlaylist
            hasLoaded = true
            contentState = nextPlaylist.items.isEmpty
                ? .empty(title: "暂无可播放内容", message: "当前听力驾驶队列为空，请稍后再试。")
                : .empty(title: "", message: "")
        } catch {
            contentState = .error(
                title: "听力驾驶加载失败",
                message: "暂时无法拉取播放列表，请检查网络与登录状态。",
                actionTitle: "重试"
            )
        }
    }

    func play() async {
        guard !items.isEmpty else { return }
        isPlaying = true
        inlineErrorMessage = nil
        await startCurrentItem()
    }

    func pause() {
        isPlaying = false
        audioPlayer.stop()
    }

    func next() async {
        guard !items.isEmpty else { return }
        audioPlayer.stop()
        playbackStage = .idle
        currentIndex = (currentIndex + 1) % items.count
        if isPlaying {
            await startCurrentItem()
        }
    }

    func previous() async {
        guard !items.isEmpty else { return }
        audioPlayer.stop()
        playbackStage = .idle
        currentIndex = (currentIndex - 1 + items.count) % items.count
        if isPlaying {
            await startCurrentItem()
        }
    }

    private func startCurrentItem() async {
        guard let item = currentItem else { return }
        switch item.mode {
        case "WASH":
            await playStage(.word, item: item, text: item.ttsPhrase ?? item.text, voice: "Cherry")
        case "STORY":
            await playStage(.meaning, item: item, text: item.text, voice: "Andre")
        default:
            await playStage(.word, item: item, text: item.word, voice: "Kai")
        }
    }

    private func playStage(_ stage: DrivePlaybackStage, item: DriveItem, text: String, voice: String? = nil) async {
        playbackStage = stage
        guard isPlaying else { return }

        do {
            let result = try await ttsService.generateTTS(
                text: text,
                voice: voice ?? item.voice,
                speed: item.speed
            )
            guard isPlaying, currentItem?.id == item.id, playbackStage == stage else { return }
            audioPlayer.play(url: result.audioURL) { [weak self] in
                await self?.audioDidFinish()
            }
        } catch {
            inlineErrorMessage = "音频生成失败，已跳过当前片段。"
            await advanceAfterFailedStage(stage, item: item)
        }
    }

    private func advanceAfterFailedStage(_ stage: DrivePlaybackStage, item: DriveItem) async {
        guard isPlaying, currentItem?.id == item.id else { return }

        switch item.mode {
        case "WASH", "STORY":
            await skipCurrentItemAfterFailure()
        default:
            switch stage {
            case .word:
                if let phrase = item.ttsPhrase, !phrase.isEmpty, phrase != item.word {
                    await playStage(.phrase, item: item, text: phrase, voice: "Kai")
                } else {
                    await playStage(.meaning, item: item, text: item.meaning, voice: "Serena")
                }
            case .phrase:
                await playStage(.meaning, item: item, text: item.meaning, voice: "Serena")
            case .meaning, .idle:
                await skipCurrentItemAfterFailure()
            }
        }
    }

    private func skipCurrentItemAfterFailure() async {
        if items.count <= 1 {
            isPlaying = false
            playbackStage = .idle
            audioPlayer.stop()
            return
        }

        await next()
    }

    private func audioDidFinish() async {
        guard isPlaying, let item = currentItem else { return }

        switch item.mode {
        case "WASH", "STORY":
            await next()
        default:
            switch playbackStage {
            case .word:
                if let phrase = item.ttsPhrase, !phrase.isEmpty, phrase != item.word {
                    await playStage(.phrase, item: item, text: phrase, voice: "Kai")
                } else {
                    await playStage(.meaning, item: item, text: item.meaning, voice: "Serena")
                }
            case .phrase:
                await playStage(.meaning, item: item, text: item.meaning, voice: "Serena")
            case .meaning, .idle:
                await next()
            }
        }
    }
}
