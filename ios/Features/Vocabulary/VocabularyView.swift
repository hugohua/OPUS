import SwiftUI

struct VocabularyView: View {
    @Bindable var viewModel: VocabularyViewModel
    let pendingDestination: DashboardDestination?
    @State private var searchDraftText = ""

    init(
        viewModel: VocabularyViewModel,
        pendingDestination: DashboardDestination? = nil
    ) {
        self.viewModel = viewModel
        self.pendingDestination = pendingDestination
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.opusBackground
                    .ignoresSafeArea()

                switch viewModel.contentState {
                case .loading:
                    OpusStateView(
                        state: .loading,
                        loadingTitle: "正在加载词库",
                        loadingMessage: "正在同步列表、标签和详情能力。"
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
                    content
                }
            }
            .navigationTitle("词库")
            .searchable(
                text: $searchDraftText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "搜索单词或释义"
            )
            .onSubmit(of: .search) {
                Task {
                    await submitSearch()
                }
            }
            .onChange(of: searchDraftText) { _, newValue in
                guard newValue.isEmpty, !viewModel.searchText.isEmpty else { return }

                Task {
                    await clearSearch()
                }
            }
            .onChange(of: viewModel.searchText) { _, newValue in
                syncSearchDraft(to: newValue)
            }
            .onChange(of: viewModel.contentState) { _, newValue in
                guard newValue == .loading, viewModel.items.isEmpty, viewModel.stats == nil else { return }
                syncSearchDraft(to: viewModel.searchText)
            }
        }
        .task {
            syncSearchDraft(to: viewModel.searchText)
            await viewModel.load()
            await applyPendingDestinationIfNeeded()
        }
        .onChange(of: pendingDestination) { _, _ in
            Task {
                await applyPendingDestinationIfNeeded()
            }
        }
        .sheet(item: Binding(
            get: { viewModel.selectedDetail.map(DetailSheetItem.init(payload:)) },
            set: { newValue in viewModel.selectedDetail = newValue?.payload }
        )) { item in
            VocabularyDetailSheet(detail: item.payload)
        }
    }

    private var content: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                filterRails

                if let stats = viewModel.stats {
                    statsCard(stats)
                }

                if viewModel.items.isEmpty {
                    OpusStateView(state: viewModel.contentState)
                } else {
                    ForEach(viewModel.items) { item in
                        Button {
                            Task {
                                await viewModel.loadDetail(id: item.id)
                            }
                        } label: {
                            OpusCard(accent: fsrsAccent(for: item.fsrs), style: .standard, isInteractive: true) {
                                OpusListRow(
                                    systemImage: rowIcon(for: item.fsrs),
                                    title: item.word,
                                    subtitle: item.definition ?? "暂无释义",
                                    detail: item.phonetic,
                                    caption: fsrsCaption(for: item.fsrs),
                                    accent: fsrsAccent(for: item.fsrs)
                                ) {
                                    fsrsMetadata(for: item.fsrs)
                                }
                            }
                        }
                        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
                        .task {
                            await viewModel.loadNextPageIfNeeded(currentItem: item)
                        }
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 120)
        }
    }

    private var filterRails: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(VocabularyStatus.allCases) { status in
                        OpusChip(
                            title: status.title,
                            accent: statusAccent(for: status),
                            isActive: viewModel.selectedStatus == status,
                            action: {
                                guard viewModel.selectedStatus != status else { return }

                                Task {
                                    viewModel.selectedStatus = status
                                    await viewModel.reloadFilters()
                                }
                            }
                        )
                    }
                }
            }

            if !viewModel.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        OpusChip(
                            title: "全部标签",
                            accent: .blue,
                            isActive: viewModel.selectedTag == nil,
                            systemImage: "tag",
                            action: {
                                guard viewModel.selectedTag != nil else { return }

                                Task {
                                    viewModel.selectedTag = nil
                                    await viewModel.reloadFilters()
                                }
                            }
                        )

                        ForEach(viewModel.tags, id: \.self) { tag in
                            OpusChip(
                                title: tag,
                                accent: .blue,
                                isActive: viewModel.selectedTag == tag,
                                action: {
                                    guard viewModel.selectedTag != tag else { return }

                                    Task {
                                        viewModel.selectedTag = tag
                                        await viewModel.reloadFilters()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private func submitSearch() async {
        guard searchDraftText != viewModel.searchText else { return }

        viewModel.searchText = searchDraftText
        await viewModel.reloadFilters()
    }

    private func clearSearch() async {
        guard searchDraftText.isEmpty, viewModel.searchText != "" else { return }

        viewModel.searchText = ""
        await viewModel.reloadFilters()
    }

    private func syncSearchDraft(to searchText: String) {
        guard searchDraftText != searchText else { return }
        searchDraftText = searchText
    }

    private func applyPendingDestinationIfNeeded() async {
        guard case .vocabulary(let status) = pendingDestination else { return }
        await viewModel.applyPendingStatus(status)
    }

    private func statsCard(_ stats: VocabularyStats) -> some View {
        OpusCard(accent: .amber, style: .compact) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    Text("记忆进度")
                        .font(OpusTypography.cardTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)

                    Spacer()

                    Text("共 \(stats.totalVocab) 词")
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                }

                OpusProgressMeter(
                    segments: [
                        OpusProgressSegment(value: Double(stats.mastered), color: OpusColorPalette.success),
                        OpusProgressSegment(value: Double(stats.learning), color: OpusColorPalette.warning),
                        OpusProgressSegment(value: Double(stats.due), color: OpusColorPalette.rose)
                    ],
                    height: 12,
                    spacing: 2
                )

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        statsBadges(stats)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        statsBadges(stats)
                    }
                }
            }
        }
    }

    private func statsBadges(_ stats: VocabularyStats) -> some View {
        Group {
            OpusBadge(title: "已掌握 \(stats.mastered)", accent: .emerald, variant: .dot)
            OpusBadge(title: "学习中 \(stats.learning)", accent: .amber, variant: .dot)
            OpusBadge(title: "待复习 \(stats.due)", accent: .rose, variant: .dot)
        }
    }

    private func fsrsMetadata(for fsrs: VocabularyFSRS) -> some View {
        VStack(alignment: .trailing, spacing: 6) {
            OpusBadge(title: fsrs.status, accent: fsrsAccent(for: fsrs), variant: .soft)

            if let nextReview = fsrs.nextReview {
                Text(nextReview)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.tertiaryText)
                    .multilineTextAlignment(.trailing)
            }
        }
    }

    private func fsrsCaption(for fsrs: VocabularyFSRS) -> String? {
        var parts: [String] = []

        if fsrs.isLeech {
            parts.append("难点词")
        }

        if fsrs.hasContext {
            parts.append("AI 情境")
        }

        if fsrs.lapses > 0 {
            parts.append("遗忘 \(fsrs.lapses) 次")
        }

        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func rowIcon(for fsrs: VocabularyFSRS) -> String {
        if fsrs.isLeech { return "exclamationmark.triangle.fill" }
        if fsrs.hasContext { return "sparkles" }
        return "textformat"
    }

    private func fsrsAccent(for fsrs: VocabularyFSRS) -> OpusAccent {
        if fsrs.isLeech { return .rose }
        if fsrs.hasContext { return .blue }

        switch fsrs.status.uppercased() {
        case "MASTERED":
            return .emerald
        case "REVIEW", "DUE":
            return .rose
        case "LEARNING":
            return .amber
        default:
            return .violet
        }
    }

    private func statusAccent(for status: VocabularyStatus) -> OpusAccent {
        switch status {
        case .all:
            return .violet
        case .new:
            return .blue
        case .learning:
            return .amber
        case .review:
            return .rose
        case .mastered:
            return .emerald
        case .leech:
            return .rose
        case .context:
            return .blue
        }
    }
}

private struct DetailSheetItem: Identifiable {
    let payload: VocabularyDetailPayload

    var id: Int { payload.vocab.id }
}

private struct VocabularyDetailSheet: View {
    let detail: VocabularyDetailPayload

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    OpusSheetHeader(
                        title: detail.vocab.word,
                        subtitle: detail.vocab.phoneticUs ?? detail.vocab.phoneticUk ?? "无音标"
                    )

                    if !detail.userTags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(detail.userTags, id: \.self) { tag in
                                    OpusChip(title: tag, accent: .blue, isActive: true, systemImage: "tag")
                                }
                            }
                        }
                    }

                    OpusCard(accent: .amber, style: .compact) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(detail.vocab.partOfSpeech ?? "释义")
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.tertiaryText)

                            Text(detail.vocab.definition_cn ?? detail.vocab.definition_jp ?? "暂无释义")
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.primaryText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    if !detail.userNote.isEmpty {
                        OpusCard(accent: .violet, style: .compact) {
                            VStack(alignment: .leading, spacing: 10) {
                                OpusBadge(title: "笔记", accent: .violet, variant: .soft)

                                Text(detail.userNote)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
                .padding(OpusSpacing.screenPadding)
            }
        }
        .presentationDetents([.medium, .large])
    }
}
