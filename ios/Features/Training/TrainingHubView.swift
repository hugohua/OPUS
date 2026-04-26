import SwiftUI

struct TrainingHubView: View {
    @Bindable var viewModel: TrainingHubViewModel
    let pendingDestination: DashboardDestination?
    let makeArenaPart5ViewModel: (String?) -> ArenaPart5ViewModel
    let makeArenaMissionViewModel: () -> ArenaMissionViewModel
    let makeDrivePlayerViewModel: (String) -> DrivePlayerViewModel

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
                            let isAvailable = viewModel.route(for: entry.destination) != nil

                            Button {
                                if isAvailable {
                                    viewModel.open(entry.destination)
                                }
                            } label: {
                                OpusCard(accent: entry.accent, style: .standard, isInteractive: isAvailable) {
                                    OpusListRow(
                                        systemImage: entry.systemImage,
                                        title: entry.title,
                                        subtitle: entry.subtitle,
                                        caption: entry.detail,
                                        accent: entry.accent,
                                        isDisabled: !isAvailable
                                    ) {
                                        availabilityView(entry.availability)
                                    }
                                }
                            }
                            .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
                            .disabled(!isAvailable)
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
                OpusBadge(title: label, accent: .emerald, variant: .soft)
            }
        case .unavailable(let reason):
            OpusBadge(title: reason, accent: .amber, variant: .soft)
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
                case .drive(let mode):
                    DrivePlayerView(viewModel: makeDrivePlayerViewModel(mode))
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
