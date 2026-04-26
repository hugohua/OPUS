import SwiftUI

struct DrivePlayerView: View {
    @Bindable var viewModel: DrivePlayerViewModel

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            switch viewModel.contentState {
            case .loading:
                OpusStateView(
                    state: .loading,
                    loadingTitle: "正在加载听力驾驶",
                    loadingMessage: "正在生成本轮播放队列。"
                )
                .padding(OpusSpacing.screenPadding)
            case .error:
                OpusStateView(
                    state: viewModel.contentState,
                    action: {
                        Task { await viewModel.load(force: true) }
                    }
                )
                .padding(OpusSpacing.screenPadding)
            case .empty:
                if viewModel.items.isEmpty {
                    OpusStateView(state: viewModel.contentState)
                        .padding(OpusSpacing.screenPadding)
                } else {
                    content
                }
            }
        }
        .navigationTitle("听力驾驶")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            controls
        }
        .task {
            await viewModel.load()
        }
    }

    private var content: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                header

                if let item = viewModel.currentItem {
                    OpusCard(accent: .amber, style: .featured) {
                        VStack(alignment: .leading, spacing: 16) {
                            Text(item.text)
                                .font(OpusTypography.cardTitle)
                                .foregroundStyle(OpusColorPalette.primaryText)
                                .fixedSize(horizontal: false, vertical: true)

                            if shouldRevealTranslation(for: item) {
                                Text(item.trans)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                            }

                            HStack(spacing: 12) {
                                OpusBadge(title: stageLabel, accent: .amber, variant: .soft)
                                OpusBadge(title: item.mode, accent: .slate, variant: .outline)
                            }

                            Divider()

                            HStack(spacing: 14) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.word)
                                        .font(.headline)
                                        .foregroundStyle(OpusColorPalette.primaryText)
                                    Text(item.phonetic.isEmpty ? item.pos : item.phonetic)
                                        .font(OpusTypography.caption)
                                        .foregroundStyle(OpusColorPalette.tertiaryText)
                                }

                                Spacer()

                                Text(shouldRevealMeaning ? item.meaning : "等待答案")
                                    .font(.headline)
                                    .foregroundStyle(shouldRevealMeaning ? OpusColorPalette.warning : OpusColorPalette.tertiaryText)
                            }
                        }
                    }
                }

                if let inlineErrorMessage = viewModel.inlineErrorMessage {
                    OpusCard(accent: .amber, style: .compact) {
                        Text(inlineErrorMessage)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.warning)
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 96)
        }
    }

    private var header: some View {
        OpusCard(accent: .slate, style: .compact) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(viewModel.modeTitle)
                        .font(OpusTypography.sectionTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)
                    Text(viewModel.progressText)
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }

                Spacer()

                Image(systemName: "car")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OpusColorPalette.warning)
            }
        }
    }

    private var controls: some View {
        HStack(spacing: 18) {
            Button {
                Task { await viewModel.previous() }
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title2)
                    .frame(width: 48, height: 48)
            }
            .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))

            Button {
                Task {
                    if viewModel.isPlaying {
                        viewModel.pause()
                    } else {
                        await viewModel.play()
                    }
                }
            } label: {
                Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title.weight(.semibold))
                    .frame(width: 76, height: 56)
            }
            .buttonStyle(.opusPress(variant: .brand, size: .large, feel: .tactile))

            Button {
                Task { await viewModel.next() }
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .frame(width: 48, height: 48)
            }
            .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
        }
        .padding(.horizontal, OpusSpacing.screenPadding)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(.regularMaterial)
    }

    private var stageLabel: String {
        switch viewModel.playbackStage {
        case .idle:
            return "待播放"
        case .word:
            return "词音"
        case .phrase:
            return "短语"
        case .meaning:
            return "释义"
        }
    }

    private var shouldRevealMeaning: Bool {
        viewModel.playbackStage == .meaning
    }

    private func shouldRevealTranslation(for item: DriveItem) -> Bool {
        item.mode != "QUIZ" || viewModel.playbackStage == .meaning
    }
}
