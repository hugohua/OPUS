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
                        VStack(alignment: .leading, spacing: 10) {
                            OpusStatusBadge(title: "HANDOFF", accent: .violet)
                            Text(pendingDescription(pendingDestination))
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
                    }
                }

                if let latest = viewModel.latest {
                    OpusCard(accent: .indigo, style: .standard) {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("最新简报")
                                    .font(OpusTypography.sectionTitle)

                                Spacer()

                                OpusBadge(title: "New", accent: .indigo, variant: .dot)
                            }

                            Text(latest.title)
                                .font(OpusTypography.cardTitle)

                            HStack(spacing: 10) {
                                OpusBadge(title: scenarioLabel(latest.scenario), accent: .blue, variant: .soft)
                                OpusBadge(title: latest.density, accent: .slate, variant: .outline)
                            }

                            OpusPrimaryButton(title: "继续阅读") {
                                Task {
                                    await viewModel.openLatestBriefing(articleID: latest.id)
                                }
                            }
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
                        VStack(alignment: .leading, spacing: 10) {
                            OpusStatusBadge(title: "GENERATION ERROR", accent: .amber)
                            Text(generationError)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.warning)
                        }
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
            .buttonStyle(.opusPress(variant: .destructive, size: .regular, feel: .tactile))
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
                            ViewThatFits(in: .horizontal) {
                                HStack(spacing: 10) {
                                    articleMetadataBadges(article)
                                }

                                VStack(alignment: .leading, spacing: 10) {
                                    articleMetadataBadges(article)
                                }
                            }
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
                    VStack(alignment: .leading, spacing: 10) {
                        OpusStatusBadge(title: "HISTORY ERROR", accent: .amber)
                        Text(historyErrorMessage)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.warning)
                    }
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
                        OpusListRow(
                            systemImage: "textformat",
                            title: word.word,
                            subtitle: word.meaning,
                            accent: .violet
                        ) {
                            OpusBadge(title: "Word", accent: .violet, variant: .soft)
                        }
                    }
                }
            }
        }
    }

    private func historyRow(_ item: BriefingHistoryItem) -> some View {
        OpusCard(accent: item.isNew ? .violet : .slate, style: .compact) {
            VStack(alignment: .leading, spacing: 10) {
                OpusListRow(
                    systemImage: item.isNew ? "sparkles" : "archivebox",
                    title: item.title,
                    caption: relativeDate(item.createdAt),
                    accent: item.isNew ? .violet : .slate
                ) {
                    VStack(alignment: .trailing, spacing: 6) {
                        OpusBadge(
                            title: item.isNew ? "未读" : "归档",
                            accent: item.isNew ? .violet : .slate,
                            variant: item.isNew ? .dot : .soft
                        )
                        OpusBadge(title: scenarioLabel(item.scenario), accent: .blue, variant: .outline)
                    }
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
                    .buttonStyle(.opusPress(variant: .secondary, size: .small, feel: .quiet))

                    Button("删除") {
                        pendingDeleteItem = item
                    }
                    .buttonStyle(.opusPress(variant: .destructive, size: .small, feel: .quiet))
                }
            }
        }
    }

    private var wandSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                OpusSheetHeader(
                    title: viewModel.wandSelection,
                    subtitle: "Wand 查词与选中文本分析",
                    closeAction: {
                        viewModel.dismissWand()
                    }
                )
                .padding(.horizontal, OpusSpacing.screenPadding)
                .padding(.top, OpusSpacing.screenPadding)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 16) {
                        if viewModel.isWandLoading {
                            OpusStateView(
                                state: .loading,
                                loadingTitle: "正在调用 Wand",
                                loadingMessage: "正在检索词义、词源与语境信息。"
                            )
                        }

                        if let lookup = viewModel.wandLookup {
                            OpusCard(accent: .indigo, style: .standard) {
                                VStack(alignment: .leading, spacing: 8) {
                                    OpusStatusBadge(title: "LOOKUP", accent: .indigo)
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
                                        OpusStatusBadge(title: "ANALYZING", accent: .violet)
                                    }
                                    Text(viewModel.wandAnalysisText.isEmpty ? "等待首段分析..." : viewModel.wandAnalysisText)
                                        .font(OpusTypography.body)
                                        .foregroundStyle(OpusColorPalette.primaryText)
                                }
                            }
                        }

                        if let wandError = viewModel.wandError {
                            OpusCard(accent: .amber, style: .compact) {
                                VStack(alignment: .leading, spacing: 10) {
                                    OpusStatusBadge(title: "WAND ERROR", accent: .amber)
                                    Text(wandError)
                                        .font(OpusTypography.body)
                                        .foregroundStyle(OpusColorPalette.warning)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, OpusSpacing.screenPadding)
                    .padding(.bottom, OpusSpacing.screenPadding)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func articleMetadataBadges(_ article: BriefingArticlePayload) -> some View {
        Group {
            OpusBadge(title: scenarioLabel(article.scenario), accent: .blue, variant: .soft)
            OpusBadge(title: article.density, accent: .slate, variant: .outline)
            OpusBadge(title: relativeDate(article.createdAt), accent: .violet, variant: .soft)
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
        switch pendingDestination {
        case .briefing, .briefingComposer, .briefingHistory:
            hasRoutedPendingDestination = true
            await viewModel.applyPendingDestination(pendingDestination)
        default:
            break
        }
    }
}
