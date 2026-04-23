import SwiftUI

struct TrainingHubView: View {
    @Bindable var viewModel: TrainingHubViewModel
    let pendingDestination: DashboardDestination?
    let makeArenaPart5ViewModel: (String?) -> ArenaPart5ViewModel
    let makeArenaMissionViewModel: () -> ArenaMissionViewModel

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
            .background(sessionNavigationLink)
        }
        .task {
            await viewModel.load()
            routePendingDestinationIfNeeded()
        }
        .onChange(of: pendingDestination) { _, _ in
            routePendingDestinationIfNeeded()
        }
    }

    private var content: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(viewModel.sections) { section in
                    VStack(alignment: .leading, spacing: 12) {
                        OpusSectionHeader(title: section.title, subtitle: section.subtitle)

                        ForEach(section.entries) { entry in
                            Button {
                                if viewModel.route(for: entry.destination) != nil {
                                    viewModel.open(entry.destination)
                                }
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
                            .disabled(viewModel.route(for: entry.destination) == nil)
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

    private var sessionNavigationLink: some View {
        NavigationLink(
            isActive: Binding(
                get: { viewModel.activeDestination != nil },
                set: { isActive in
                    if !isActive {
                        viewModel.activeDestination = nil
                    }
                }
            )
        ) {
            if let destination = viewModel.activeDestination {
                switch viewModel.route(for: destination) {
                case .session(let sessionDestination):
                    SessionRunnerView(
                        viewModel: viewModel.buildSessionRunnerViewModel(for: sessionDestination)
                    )
                case .arenaPart5(let grammarNodeID):
                    ArenaPart5View(viewModel: makeArenaPart5ViewModel(grammarNodeID))
                case .arenaMission:
                    ArenaMissionView(viewModel: makeArenaMissionViewModel())
                case nil:
                    EmptyView()
                }
            } else {
                EmptyView()
            }
        } label: {
            EmptyView()
        }
    }

    private func routePendingDestinationIfNeeded() {
        guard let pendingDestination else { return }

        if viewModel.route(for: pendingDestination) != nil,
           viewModel.activeDestination != pendingDestination {
            viewModel.open(pendingDestination)
        }
    }
}
