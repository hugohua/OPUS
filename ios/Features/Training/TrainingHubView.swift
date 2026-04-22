import SwiftUI

struct TrainingHubView: View {
    @Bindable var viewModel: TrainingHubViewModel
    let pendingDestination: DashboardDestination?

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.opusBackground
                    .ignoresSafeArea()

                switch viewModel.contentState {
                case .loading:
                    OpusStateView(
                        state: .loading,
                        loadingTitle: "正在加载训练页",
                        loadingMessage: "正在同步模式入口与可用性。"
                    )
                    .padding(OpusSpacing.screenPadding)
                case .error:
                    OpusStateView(
                        state: viewModel.contentState,
                        action: {
                            Task {
                                await viewModel.load(force: true)
                            }
                        }
                    )
                    .padding(OpusSpacing.screenPadding)
                case .empty:
                    if viewModel.sections.isEmpty {
                        OpusStateView(state: viewModel.contentState)
                            .padding(OpusSpacing.screenPadding)
                    } else {
                        content
                    }
                }
            }
            .navigationTitle("训练")
        }
        .task {
            await viewModel.load()
        }
    }

    private var content: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                if let pendingDestination {
                    OpusCard(accent: .violet, style: .compact) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("首页已交接到训练页")
                                .font(OpusTypography.sectionTitle)
                                .foregroundStyle(OpusColorPalette.primaryText)

                            Text(destinationDescription(pendingDestination))
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }
                }

                ForEach(viewModel.sections) { section in
                    VStack(alignment: .leading, spacing: 12) {
                        OpusSectionHeader(title: section.title, subtitle: section.subtitle)

                        ForEach(section.entries) { entry in
                            Button {
                                viewModel.open(entry.destination)
                            } label: {
                                OpusCard(accent: entry.accent, style: .standard) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        HStack(alignment: .top, spacing: 12) {
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .fill(entry.accent.softColor)
                                                .frame(width: 52, height: 52)
                                                .overlay {
                                                    Image(systemName: entry.systemImage)
                                                        .foregroundStyle(entry.accent.primaryColor)
                                                }

                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(entry.title)
                                                    .font(OpusTypography.cardTitle)
                                                    .foregroundStyle(OpusColorPalette.primaryText)

                                                Text(entry.subtitle)
                                                    .font(OpusTypography.body)
                                                    .foregroundStyle(OpusColorPalette.secondaryText)

                                                Text(entry.detail)
                                                    .font(OpusTypography.caption)
                                                    .foregroundStyle(OpusColorPalette.tertiaryText)
                                            }

                                            Spacer()
                                        }

                                        availabilityView(entry.availability)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if let activeDestination = viewModel.activeDestination {
                    OpusCard(accent: .amber, style: .compact) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("后续会话接口已预留")
                                .font(OpusTypography.sectionTitle)
                                .foregroundStyle(OpusColorPalette.primaryText)

                            Text(destinationDescription(activeDestination))
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 120)
        }
    }

    @ViewBuilder
    private func availabilityView(_ availability: TrainingHubAvailability) -> some View {
        switch availability {
        case .available(let label):
            if let label {
                Text(label)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.success)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule(style: .continuous)
                            .fill(OpusColorPalette.success.opacity(0.12))
                    )
            }
        case .unavailable(let reason):
            Text(reason)
                .font(OpusTypography.caption)
                .foregroundStyle(OpusColorPalette.warning)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    Capsule(style: .continuous)
                        .fill(OpusColorPalette.warning.opacity(0.12))
                )
        }
    }

    private func destinationDescription(_ destination: DashboardDestination) -> String {
        switch destination {
        case .training(let mode):
            return "Session Runner 将接收模式 `\(mode)`。"
        case .reviewCards:
            return "后续将接入 Review Cards 独立会话。"
        case .audio:
            return "后续将接入 Audio 训练独立会话。"
        case .arena(let path, _):
            return "后续将跳转到 Arena `\(path)` 入口。"
        case .briefing(let articleID):
            if let articleID {
                return "后续将打开 articleId=`\(articleID)` 的简报阅读。"
            }
            return "后续将打开简报入口。"
        }
    }
}
