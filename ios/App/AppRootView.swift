import SwiftUI

struct AppRootView: View {
    @Bindable var launchCoordinator: LaunchCoordinator
    @Bindable var dashboardViewModel: DashboardViewModel
    @Bindable var diagnosticsViewModel: DiagnosticsViewModel

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
                    diagnosticsViewModel: diagnosticsViewModel
                )
            }
        }
        .task {
            await launchCoordinator.start()
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
