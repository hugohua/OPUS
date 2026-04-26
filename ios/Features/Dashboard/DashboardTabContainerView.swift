import SwiftUI
import UIKit

struct DashboardTabContainerView: View {
    @Bindable var viewModel: DashboardViewModel
    @Bindable var diagnosticsViewModel: DiagnosticsViewModel
    @Bindable var trainingHubViewModel: TrainingHubViewModel
    @Bindable var arenaDashboardViewModel: ArenaDashboardViewModel
    @Bindable var vocabularyViewModel: VocabularyViewModel
    @Bindable var briefingViewModel: BriefingViewModel
    let makeArenaPart5ViewModel: (String?) -> ArenaPart5ViewModel
    let makeArenaMissionViewModel: () -> ArenaMissionViewModel
    @State private var isDiagnosticsPresented = false

    var body: some View {
        TabView(selection: bindingForSelection) {
            homeTab
                .tag(DashboardTab.home)
                .tabItem {
                    Label(DashboardTab.home.title, systemImage: DashboardTab.home.systemImage)
                }

            TrainingHubView(
                viewModel: trainingHubViewModel,
                pendingDestination: trainingPendingDestination,
                makeArenaPart5ViewModel: makeArenaPart5ViewModel,
                makeArenaMissionViewModel: makeArenaMissionViewModel
            )
                .tag(DashboardTab.training)
                .tabItem {
                    Label(DashboardTab.training.title, systemImage: DashboardTab.training.systemImage)
                }

            ArenaDashboardView(
                viewModel: arenaDashboardViewModel,
                pendingDestination: arenaPendingDestination,
                makeArenaPart5ViewModel: makeArenaPart5ViewModel,
                makeArenaMissionViewModel: makeArenaMissionViewModel
            )
                .tag(DashboardTab.arena)
                .tabItem {
                    Label(DashboardTab.arena.title, systemImage: DashboardTab.arena.systemImage)
                }

            VocabularyView(viewModel: vocabularyViewModel)
                .tag(DashboardTab.vocabulary)
                .tabItem {
                    Label(DashboardTab.vocabulary.title, systemImage: DashboardTab.vocabulary.systemImage)
                }

            BriefingView(
                viewModel: briefingViewModel,
                pendingDestination: briefingPendingDestination
            )
                .tag(DashboardTab.briefing)
                .tabItem {
                    Label(DashboardTab.briefing.title, systemImage: DashboardTab.briefing.systemImage)
                }
        }
        .tint(OpusColorPalette.brand)
        .onAppear(perform: applyTabBarAppearance)
        .task {
            await viewModel.loadHome()
        }
        .onChange(of: viewModel.selectedTab) { _, newValue in
            if newValue == .home {
                Task {
                    await viewModel.loadHome()
                }
            }
        }
        .sheet(isPresented: $isDiagnosticsPresented) {
            NavigationStack {
                DiagnosticsHomeView(viewModel: diagnosticsViewModel)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("关闭") {
                                isDiagnosticsPresented = false
                            }
                        }
                    }
            }
            .presentationDetents([.large])
        }
    }

    private var bindingForSelection: Binding<DashboardTab> {
        Binding(
            get: { viewModel.selectedTab },
            set: { viewModel.selectTab($0) }
        )
    }

    private var trainingPendingDestination: DashboardDestination? {
        guard let pendingDestination = viewModel.pendingDestination else { return nil }
        switch pendingDestination {
        case .training, .reviewCards, .audio:
            return pendingDestination
        default:
            return nil
        }
    }

    private var briefingPendingDestination: DashboardDestination? {
        guard let pendingDestination = viewModel.pendingDestination else { return nil }
        if case .briefing = pendingDestination {
            return pendingDestination
        }
        return nil
    }

    private var arenaPendingDestination: DashboardDestination? {
        guard let pendingDestination = viewModel.pendingDestination else { return nil }
        if case .arena = pendingDestination {
            return pendingDestination
        }
        return nil
    }

    @ViewBuilder
    private var homeTab: some View {
        NavigationStack {
            ZStack {
                LinearGradient.opusBackground
                    .ignoresSafeArea()

                switch viewModel.homeContentState {
                case .loading:
                    OpusStateView(
                        state: .loading,
                        loadingTitle: "正在加载首页",
                        loadingMessage: "正在拉取移动端 summary。"
                    )
                    .padding(OpusSpacing.screenPadding)
                case .error:
                    OpusStateView(
                        state: viewModel.homeContentState,
                        action: {
                            Task {
                                await viewModel.loadHome(force: true)
                            }
                        }
                    )
                    .padding(OpusSpacing.screenPadding)
                case .empty:
                    if let homeState = viewModel.homeState {
                        DashboardHomeView(
                            homeState: homeState,
                            onOpenDiagnostics: { isDiagnosticsPresented = true },
                            onOpenDestination: { destination in
                                viewModel.open(destination)
                            }
                        )
                    } else {
                        OpusStateView(
                            state: .empty(
                                title: "首页暂无内容",
                                message: "summary 还没有可展示的数据，请稍后重试。",
                                actionTitle: "刷新"
                            ),
                            action: {
                                Task {
                                    await viewModel.loadHome(force: true)
                                }
                            }
                        )
                        .padding(OpusSpacing.screenPadding)
                    }
                }
            }
            .navigationTitle(DashboardTab.home.title)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func applyTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = UIColor(OpusColorPalette.tabBarBackground)
        appearance.shadowColor = UIColor(OpusColorPalette.border)

        let normal = appearance.stackedLayoutAppearance.normal
        normal.iconColor = UIColor(OpusColorPalette.tertiaryText)
        normal.titleTextAttributes = [.foregroundColor: UIColor(OpusColorPalette.tertiaryText)]

        let selected = appearance.stackedLayoutAppearance.selected
        selected.iconColor = UIColor(OpusColorPalette.brand)
        selected.titleTextAttributes = [.foregroundColor: UIColor(OpusColorPalette.brand)]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

private struct DashboardPlaceholderView: View {
    let tab: DashboardTab
    let pendingDestination: DashboardDestination?

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.opusBackground
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 18) {
                    OpusSectionHeader(
                        title: tab.title,
                        subtitle: "这一层先保留原生骨架，为后续接入真实页面做准备。"
                    )

                    OpusStateView(
                        state: .empty(
                            title: tab.title,
                            message: description
                        )
                    )

                    if let pendingDestination, tabMatchesPendingDestination {
                        OpusCard(accent: .violet, style: .compact) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("已接收首页跳转")
                                    .font(OpusTypography.sectionTitle)
                                    .foregroundStyle(OpusColorPalette.primaryText)

                                Text(pendingDescription(for: pendingDestination))
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                            }
                        }
                    }
                }
                .padding(OpusSpacing.screenPadding)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .navigationTitle(tab.title)
        }
    }

    private var description: String {
        switch tab {
        case .home:
            return ""
        case .training:
            return "下一步会把训练入口、模式路由和状态摘要逐个接进来。"
        case .arena:
            return "保留竞技场入口位置，后续接入诊断和靶向练习。"
        case .vocabulary:
            return "词库会继承同一套卡片和筛选层级。"
        case .briefing:
            return "简报模块后续会承接 Weaver Console 与阅读流。"
        }
    }

    private var tabMatchesPendingDestination: Bool {
        guard let pendingDestination else { return false }

        switch (tab, pendingDestination) {
        case (.training, .training), (.training, .reviewCards), (.training, .audio):
            return true
        case (.arena, .arena):
            return true
        case (.briefing, .briefing):
            return true
        default:
            return false
        }
    }

    private func pendingDescription(for destination: DashboardDestination) -> String {
        switch destination {
        case .training(let mode):
            return "后续会话将承接模式 `\(mode)`。"
        case .reviewCards:
            return "后续会话将承接复习卡组入口。"
        case .audio:
            return "后续会话将承接听力训练入口。"
        case .arena(let path, let grammarNodeID):
            if let grammarNodeID {
                return "后续会话将承接 Arena `\(path)`，并带入 grammarNodeId=`\(grammarNodeID)`。"
            }
            return "后续会话将承接 Arena `\(path)` 入口。"
        case .briefing(let articleID):
            if let articleID {
                return "后续会话将承接 articleId=`\(articleID)` 的简报阅读。"
            }
            return "后续会话将承接简报入口。"
        }
    }
}
