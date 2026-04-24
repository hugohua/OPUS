import SwiftUI

struct AppRootView: View {
    @Bindable var launchCoordinator: LaunchCoordinator
    @Bindable var dashboardViewModel: DashboardViewModel
    @Bindable var diagnosticsViewModel: DiagnosticsViewModel
    @Bindable var trainingHubViewModel: TrainingHubViewModel
    @Bindable var arenaDashboardViewModel: ArenaDashboardViewModel
    @Bindable var vocabularyViewModel: VocabularyViewModel
    @Bindable var briefingViewModel: BriefingViewModel
    let makeArenaPart5ViewModel: (String?) -> ArenaPart5ViewModel
    let makeArenaMissionViewModel: () -> ArenaMissionViewModel

    var body: some View {
        Group {
            switch launchCoordinator.phase {
            case .launching, .restoring:
                AppLaunchLoadingView(phase: launchCoordinator.phase)
            case .unauthenticated:
                AuthRootView(launchCoordinator: launchCoordinator)
            case .authenticated:
                DashboardTabContainerView(
                    viewModel: dashboardViewModel,
                    diagnosticsViewModel: diagnosticsViewModel,
                    trainingHubViewModel: trainingHubViewModel,
                    arenaDashboardViewModel: arenaDashboardViewModel,
                    vocabularyViewModel: vocabularyViewModel,
                    briefingViewModel: briefingViewModel,
                    makeArenaPart5ViewModel: makeArenaPart5ViewModel,
                    makeArenaMissionViewModel: makeArenaMissionViewModel
                )
            }
        }
        .task {
            await launchCoordinator.start()
        }
        .onChange(of: launchCoordinator.currentSession?.user.id) { oldValue, newValue in
            if oldValue != newValue {
                diagnosticsViewModel.resetTransientState()
                dashboardViewModel.resetForSessionChange()
                trainingHubViewModel.resetForSessionChange()
                arenaDashboardViewModel.resetForSessionChange()
                vocabularyViewModel.resetForSessionChange()
                briefingViewModel.resetForSessionChange()
            }
        }
    }
}

private struct AppLaunchLoadingView: View {
    let phase: LaunchCoordinator.Phase

    var body: some View {
        ZStack {
            LinearGradient.opusBackground
                .ignoresSafeArea()

            OpusStateView(
                state: .loading,
                loadingTitle: phase == .launching ? "正在启动 App" : "正在恢复会话",
                loadingMessage: phase == .launching
                    ? "正在装配认证与根壳层依赖。"
                    : "正在检查本地 token 与服务端会话。"
            )
            .padding(OpusSpacing.screenPadding)
        }
    }
}
