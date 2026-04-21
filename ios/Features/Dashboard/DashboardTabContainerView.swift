import SwiftUI
import UIKit

struct DashboardTabContainerView: View {
    @Bindable var viewModel: DashboardViewModel
    @Bindable var diagnosticsViewModel: DiagnosticsViewModel
    @State private var isDiagnosticsPresented = false

    var body: some View {
        TabView(selection: bindingForSelection) {
            DashboardHomeView(
                homeState: viewModel.homeState,
                onOpenDiagnostics: { isDiagnosticsPresented = true }
            )
            .tag(DashboardTab.home)
            .tabItem {
                Label(DashboardTab.home.title, systemImage: DashboardTab.home.systemImage)
            }

            ForEach(viewModel.tabs.filter { $0 != .home }) { tab in
                DashboardPlaceholderView(tab: tab)
                    .tag(tab)
                    .tabItem {
                        Label(tab.title, systemImage: tab.systemImage)
                    }
            }
        }
        .tint(OpusColorPalette.brand)
        .onAppear(perform: applyTabBarAppearance)
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

                    OpusCard(accent: accent, style: .standard) {
                        VStack(alignment: .leading, spacing: 12) {
                            Label(tab.title, systemImage: tab.systemImage)
                                .font(OpusTypography.cardTitle)
                                .foregroundStyle(OpusColorPalette.primaryText)

                            Text(description)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
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

    private var accent: DashboardAccent {
        switch tab {
        case .home:
            return .violet
        case .training:
            return .violet
        case .arena:
            return .emerald
        case .vocabulary:
            return .amber
        case .briefing:
            return .indigo
        }
    }
}
