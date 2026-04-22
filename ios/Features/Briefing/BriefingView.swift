import SwiftUI

struct BriefingView: View {
    @Bindable var viewModel: BriefingViewModel
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
                        loadingTitle: "正在加载简报模块",
                        loadingMessage: "正在同步最新简报与词汇食材。"
                    )
                    .padding(OpusSpacing.screenPadding)
                case .error:
                    OpusStateView(
                        state: viewModel.contentState,
                        action: {
                            Task {
                                await viewModel.loadInitialData()
                            }
                        }
                    )
                    .padding(OpusSpacing.screenPadding)
                case .empty:
                    content
                }
            }
            .navigationTitle("简报")
        }
        .task {
            await viewModel.loadInitialData()
        }
        .onAppear {
            if case .briefing(let articleID) = pendingDestination {
                viewModel.openLatestBriefing(articleID: articleID)
            }
        }
        .onChange(of: viewModel.latest?.id) { _, _ in
            if case .briefing(let articleID) = pendingDestination {
                viewModel.openLatestBriefing(articleID: articleID)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .console:
            consoleView
        case .generating:
            generatingView
        case .reader:
            readerView
        }
    }

    private var consoleView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                if let pendingDestination {
                    OpusCard(accent: .violet, style: .compact) {
                        Text("首页交接：\(pendingDescription(pendingDestination))")
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }
                }

                if let latest = viewModel.latest {
                    OpusCard(accent: .indigo, style: .compact) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("最新简报")
                                .font(OpusTypography.sectionTitle)
                            Text(latest.title)
                                .font(OpusTypography.body)
                            Text("scenario: \(latest.scenario)")
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }
                }

                Picker("Scenario", selection: $viewModel.selectedScenario) {
                    Text("Finance").tag("finance_group")
                    Text("HR").tag("hr_group")
                    Text("Ops").tag("ops_group")
                    Text("Market").tag("market_group")
                    Text("Office").tag("office_group")
                    Text("Travel").tag("travel_group")
                }
                .pickerStyle(.menu)

                Picker("Density", selection: $viewModel.selectedDensity) {
                    Text("Light").tag("light")
                    Text("Balanced").tag("balanced")
                    Text("Dense").tag("dense")
                }
                .pickerStyle(.segmented)

                OpusPrimaryButton(title: "刷新词汇食材") {
                    Task {
                        await viewModel.refreshIngredients()
                    }
                }

                wordSection(title: "Priority Words", words: viewModel.priorityWords)
                wordSection(title: "Filler Words", words: viewModel.fillerWords)

                if let generationError = viewModel.generationError {
                    OpusCard(accent: .amber, style: .compact) {
                        Text(generationError)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.warning)
                    }
                }

                OpusPrimaryButton(title: "开始生成") {
                    Task {
                        await viewModel.startGeneration()
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 120)
        }
    }

    private var generatingView: some View {
        VStack(alignment: .leading, spacing: 16) {
            OpusStateView(
                state: .loading,
                loadingTitle: "正在生成简报",
                loadingMessage: "正在消费移动端 SSE 输出。"
            )

            ScrollView {
                Text(viewModel.generatedText.isEmpty ? "等待首个 token..." : viewModel.generatedText)
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button("取消并返回控制台") {
                viewModel.resetToConsole()
            }
            .font(OpusTypography.caption)
        }
        .padding(OpusSpacing.screenPadding)
    }

    private var readerView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Minimal Reader")
                    .font(OpusTypography.pageTitle)
                Text(viewModel.generatedText)
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.primaryText)
                OpusPrimaryButton(title: "返回控制台") {
                    viewModel.resetToConsole()
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 120)
        }
    }

    private func wordSection(title: String, words: [BriefingWord]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            OpusSectionHeader(title: title, subtitle: "\(words.count) 个")

            if words.isEmpty {
                OpusStateView(
                    state: .empty(
                        title: "当前没有词汇",
                        message: "可以切换场景或刷新词汇食材。"
                    )
                )
            } else {
                ForEach(words) { word in
                    OpusCard(accent: .violet, style: .compact) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(word.word)
                                .font(OpusTypography.sectionTitle)
                            Text(word.meaning)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }
                }
            }
        }
    }

    private func pendingDescription(_ destination: DashboardDestination) -> String {
        switch destination {
        case .briefing(let articleID):
            if let articleID {
                return "待打开 articleId=`\(articleID)` 的简报阅读。"
            }
            return "待打开简报入口。"
        default:
            return "待切换到简报模块。"
        }
    }
}
