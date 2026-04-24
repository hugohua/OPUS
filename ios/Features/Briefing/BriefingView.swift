import SwiftUI

struct BriefingView: View {
    @Bindable var viewModel: BriefingViewModel
    let pendingDestination: DashboardDestination?
    @State private var pendingDeleteItem: BriefingHistoryItem?
    @State private var hasRoutedPendingDestination = false

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
            await routePendingDestinationIfNeeded()
        }
        .onChange(of: viewModel.latest?.id) { _, _ in
            Task {
                await routePendingDestinationIfNeeded()
            }
        }
        .onChange(of: viewModel.selectedHistoryScenario) { _, _ in
            Task {
                await viewModel.reloadHistory()
            }
        }
        .onChange(of: viewModel.selectedHistoryStatus) { _, _ in
            Task {
                await viewModel.reloadHistory()
            }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.isWandSheetPresented },
            set: { isPresented in
                if !isPresented {
                    viewModel.dismissWand()
                }
            }
        )) {
            wandSheet
        }
        .alert(
            "确认删除",
            isPresented: Binding(
                get: { pendingDeleteItem != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingDeleteItem = nil
                    }
                }
            ),
            presenting: pendingDeleteItem
        ) { item in
            Button("取消", role: .cancel) {
                pendingDeleteItem = nil
            }
            Button("删除", role: .destructive) {
                pendingDeleteItem = nil
                Task {
                    await viewModel.confirmDeleteHistoryArticle(id: item.id)
                }
            }
        } message: { item in
            Text("删除后会立即刷新列表，且不提供撤销。确认删除《\(item.title)》吗？")
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
                    OpusCard(accent: .indigo, style: .standard) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("最新简报")
                                .font(OpusTypography.sectionTitle)
                            Text(latest.title)
                                .font(OpusTypography.cardTitle)
                            Text("scenario: \(scenarioLabel(latest.scenario)) · density: \(latest.density)")
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.secondaryText)

                            Button("继续阅读") {
                                Task {
                                    await viewModel.openLatestBriefing(articleID: latest.id)
                                }
                            }
                            .font(OpusTypography.caption)
                        }
                    }
                }

                historySection

                Picker("Scenario", selection: $viewModel.selectedScenario) {
                    ForEach(BriefingScenarioOption.allCases) { scenario in
                        Text(scenario.title).tag(scenario.rawValue)
                    }
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

    @ViewBuilder
    private var readerView: some View {
        if viewModel.isReaderLoading {
            OpusStateView(
                state: .loading,
                loadingTitle: "正在打开简报",
                loadingMessage: "正在恢复正文与上下文。"
            )
            .padding(OpusSpacing.screenPadding)
        } else if let readerError = viewModel.readerError {
            OpusStateView(
                state: .error(
                    title: "打开失败",
                    message: readerError,
                    actionTitle: "返回控制台"
                ),
                action: {
                    viewModel.closeReader()
                }
            )
            .padding(OpusSpacing.screenPadding)
        } else if let article = viewModel.currentArticle {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    OpusCard(accent: .violet, style: .standard) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(article.parsedContent.title)
                                .font(OpusTypography.serifTitle)
                            Text("场景 \(scenarioLabel(article.scenario)) · 密度 \(article.density) · \(relativeDate(article.createdAt))")
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                            Text("长按正文即可触发 Wand 查词或分析。")
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }

                    BriefingSelectableTextView(
                        text: article.parsedContent.bodyParagraphs.joined(separator: "\n\n"),
                        onLookup: { selectedWord in
                            Task {
                                await viewModel.lookupSelection(selectedWord)
                            }
                        },
                        onAnalyze: { selectedText, context in
                            Task {
                                await viewModel.analyzeSelection(selectedText, context: context)
                            }
                        }
                    )
                    .padding(OpusSpacing.cardPadding)
                    .background(
                        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                            .fill(OpusColorPalette.elevatedSurface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                            .stroke(OpusColorPalette.border, lineWidth: 1)
                    )

                    if !article.parsedContent.translationParagraphs.isEmpty {
                        OpusSectionHeader(title: "参考译文", subtitle: "按段落对应显示")

                        ForEach(Array(article.parsedContent.translationParagraphs.enumerated()), id: \.offset) { _, paragraph in
                            OpusCard(accent: .indigo, style: .compact) {
                                Text(paragraph)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                            }
                        }
                    }

                    if !article.targetWords.isEmpty {
                        wordSection(title: "Target Words", words: article.targetWords)
                    }

                    OpusPrimaryButton(title: "返回控制台") {
                        viewModel.closeReader()
                    }
                }
                .padding(OpusSpacing.screenPadding)
                .padding(.bottom, 120)
            }
        } else {
            OpusStateView(
                state: .empty(
                    title: "没有可显示的正文",
                    message: "请返回控制台后重新打开简报。"
                )
            )
            .padding(OpusSpacing.screenPadding)
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            OpusSectionHeader(title: "历史简报", subtitle: "按场景和新旧状态查看最近阅读。")

            Picker("历史场景", selection: $viewModel.selectedHistoryScenario) {
                Text("全部场景").tag(Optional<BriefingScenarioOption>.none)
                ForEach(viewModel.historyAvailableScenarios) { scenario in
                    Text(scenario.title).tag(Optional(scenario))
                }
            }
            .pickerStyle(.menu)

            Picker("历史状态", selection: $viewModel.selectedHistoryStatus) {
                ForEach(BriefingHistoryStatusFilter.allCases) { filter in
                    Text(filter.title).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            switch viewModel.historyContentState {
            case .loading:
                OpusStateView(
                    state: .loading,
                    loadingTitle: "正在加载历史简报",
                    loadingMessage: "正在同步场景与新旧状态筛选结果。"
                )
            case .error:
                OpusStateView(
                    state: viewModel.historyContentState,
                    action: {
                        Task {
                            await viewModel.reloadHistory()
                        }
                    }
                )
            case .empty:
                if viewModel.historyItems.isEmpty {
                    OpusStateView(state: viewModel.historyContentState)
                } else {
                    ForEach(viewModel.historyItems) { item in
                        historyRow(item)
                    }
                }
            }

            if let historyErrorMessage = viewModel.historyErrorMessage {
                OpusCard(accent: .amber, style: .compact) {
                    Text(historyErrorMessage)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.warning)
                }
            }
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

    private func historyRow(_ item: BriefingHistoryItem) -> some View {
        OpusCard(accent: item.isNew ? .violet : .slate, style: .compact) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(OpusTypography.sectionTitle)
                        Text("\(scenarioLabel(item.scenario)) · \(item.isNew ? "未读" : "归档") · \(relativeDate(item.createdAt))")
                            .font(OpusTypography.caption)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }

                    Spacer(minLength: 0)
                }

                if !item.vocabPreview.isEmpty {
                    Text("词汇预览：\(item.vocabPreview)")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }

                HStack(spacing: 12) {
                    Button("进入详情") {
                        Task {
                            await viewModel.openHistoryArticle(id: item.id)
                        }
                    }
                    .font(OpusTypography.caption)

                    Button("删除") {
                        pendingDeleteItem = item
                    }
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.warning)
                }
            }
        }
    }

    private var wandSheet: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(viewModel.wandSelection)
                        .font(OpusTypography.pageTitle)

                    if viewModel.isWandLoading {
                        ProgressView("正在调用 Wand")
                    }

                    if let lookup = viewModel.wandLookup {
                        OpusCard(accent: .indigo, style: .standard) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(lookup.vocab.phonetic.isEmpty ? "无音标" : lookup.vocab.phonetic)
                                    .font(OpusTypography.caption)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                                Text(lookup.vocab.meaning)
                                    .font(OpusTypography.body)
                                if let etymology = lookup.etymology {
                                    Text("词源模式：\(etymology.mode)")
                                        .font(OpusTypography.caption)
                                        .foregroundStyle(OpusColorPalette.secondaryText)
                                    if let memoryHook = etymology.memoryHook, !memoryHook.isEmpty {
                                        Text(memoryHook)
                                            .font(OpusTypography.body)
                                            .foregroundStyle(OpusColorPalette.secondaryText)
                                    }
                                }
                            }
                        }
                    }

                    if !viewModel.wandAnalysisText.isEmpty || viewModel.isWandAnalyzing {
                        OpusCard(accent: .violet, style: .standard) {
                            VStack(alignment: .leading, spacing: 10) {
                                if viewModel.isWandAnalyzing {
                                    ProgressView("分析进行中")
                                }
                                Text(viewModel.wandAnalysisText.isEmpty ? "等待首段分析..." : viewModel.wandAnalysisText)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.primaryText)
                            }
                        }
                    }

                    if let wandError = viewModel.wandError {
                        OpusCard(accent: .amber, style: .compact) {
                            Text(wandError)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.warning)
                        }
                    }
                }
                .padding(OpusSpacing.screenPadding)
            }
            .navigationTitle("Wand")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("关闭") {
                        viewModel.dismissWand()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
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

    private func scenarioLabel(_ rawValue: String) -> String {
        BriefingScenarioOption.allCases.first(where: { $0.rawValue == rawValue })?.title ?? rawValue
    }

    private func relativeDate(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else {
            return value
        }

        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func routePendingDestinationIfNeeded() async {
        guard !hasRoutedPendingDestination, let pendingDestination else { return }
        if case .briefing(let articleID) = pendingDestination {
            hasRoutedPendingDestination = true
            await viewModel.openLatestBriefing(articleID: articleID)
        }
    }
}
