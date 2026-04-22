import SwiftUI

struct VocabularyView: View {
    @Bindable var viewModel: VocabularyViewModel

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
        }
        .task {
            await viewModel.load()
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
                searchAndFilters

                if let stats = viewModel.stats {
                    OpusCard(accent: .amber, style: .compact) {
                        Text("已掌握 \(stats.mastered) · 学习中 \(stats.learning) · 待复习 \(stats.due)")
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }
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
                            OpusCard(accent: .amber, style: .standard) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(item.word)
                                        .font(OpusTypography.cardTitle)
                                    if let phonetic = item.phonetic {
                                        Text(phonetic)
                                            .font(OpusTypography.caption)
                                            .foregroundStyle(OpusColorPalette.secondaryText)
                                    }
                                    Text(item.definition ?? "暂无释义")
                                        .font(OpusTypography.body)
                                        .foregroundStyle(OpusColorPalette.secondaryText)
                                    Text(item.fsrs.status)
                                        .font(OpusTypography.caption)
                                        .foregroundStyle(OpusColorPalette.tertiaryText)
                                }
                            }
                        }
                        .buttonStyle(.plain)
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

    private var searchAndFilters: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("搜索单词或释义", text: $viewModel.searchText)
                .textFieldStyle(.roundedBorder)

            Picker("状态", selection: $viewModel.selectedStatus) {
                ForEach(VocabularyStatus.allCases) { status in
                    Text(status.title).tag(status)
                }
            }
            .pickerStyle(.menu)
            .onChange(of: viewModel.selectedStatus) { _, _ in
                Task {
                    await viewModel.reloadFilters()
                }
            }

            if !viewModel.tags.isEmpty {
                Picker("标签", selection: Binding(
                    get: { viewModel.selectedTag ?? "" },
                    set: { newValue in
                        viewModel.selectedTag = newValue.isEmpty ? nil : newValue
                        Task {
                            await viewModel.reloadFilters()
                        }
                    }
                )) {
                    Text("全部标签").tag("")
                    ForEach(viewModel.tags, id: \.self) { tag in
                        Text(tag).tag(tag)
                    }
                }
                .pickerStyle(.menu)
            }

            Button("应用搜索") {
                Task {
                    await viewModel.reloadFilters()
                }
            }
            .font(OpusTypography.caption)
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
            VStack(alignment: .leading, spacing: 16) {
                Text(detail.vocab.word)
                    .font(OpusTypography.pageTitle)
                Text(detail.vocab.phoneticUs ?? detail.vocab.phoneticUk ?? "无音标")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)
                Text(detail.vocab.definition_cn ?? detail.vocab.definition_jp ?? "暂无释义")
                    .font(OpusTypography.body)
                if !detail.userTags.isEmpty {
                    Text("标签：\(detail.userTags.joined(separator: ", "))")
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }
                if !detail.userNote.isEmpty {
                    Text(detail.userNote)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }
                Spacer()
            }
            .padding(OpusSpacing.screenPadding)
        }
        .presentationDetents([.medium, .large])
    }
}
