import SwiftUI

struct ArenaDashboardView: View {
    @Bindable var viewModel: ArenaDashboardViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.opusBackground
                    .ignoresSafeArea()

                switch viewModel.contentState {
                case .loading:
                    OpusStateView(
                        state: .loading,
                        loadingTitle: "正在加载竞技场",
                        loadingMessage: "正在同步概览与语法矩阵。"
                    )
                    .padding(OpusSpacing.screenPadding)
                case .error:
                    OpusStateView(
                        state: viewModel.contentState,
                        action: {
                            Task {
                                await viewModel.loadOverview(force: true)
                            }
                        }
                    )
                    .padding(OpusSpacing.screenPadding)
                case .empty:
                    content
                }
            }
            .navigationTitle("竞技")
        }
        .task {
            await viewModel.loadOverview()
        }
        .sheet(item: $viewModel.selectedKnot) { knot in
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Text(knot.name)
                        .font(OpusTypography.pageTitle)
                    Text(knot.nameEn ?? "No English name")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                    Text("掌握度 \(knot.masteryScore)% · 题量 \(knot.availableQs)")
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.tertiaryText)

                    OpusPrimaryButton(title: "预留 Part 5 定向入口") {
                        viewModel.open(.arena(path: "part5", grammarNodeID: knot.id))
                    }

                    Spacer()
                }
                .padding(OpusSpacing.screenPadding)
            }
            .presentationDetents([.medium])
        }
    }

    private var content: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                Picker("Tab", selection: $viewModel.selectedTab) {
                    ForEach(ArenaDashboardViewModel.Tab.allCases) { tab in
                        Text(tab == .overview ? "概览" : "矩阵")
                            .tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: viewModel.selectedTab) { _, newValue in
                    viewModel.switchTab(newValue)
                }

                if viewModel.selectedTab == .overview {
                    overviewSection
                } else {
                    matrixSection
                }

                if let activeDestination = viewModel.activeDestination {
                    OpusCard(accent: .amber, style: .compact) {
                        Text(destinationDescription(activeDestination))
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 120)
        }
    }

    private var overviewSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let overview = viewModel.overview {
                OpusSectionHeader(title: "语法雷达", subtitle: "按 L1 领域查看当前掌握度。")

                ForEach(overview.radar) { domain in
                    OpusCard(accent: .violet, style: .compact) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(domain.label)
                                    .font(OpusTypography.sectionTitle)
                                Text(domain.code)
                                    .font(OpusTypography.caption)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                            }

                            Spacer()

                            Text("\(domain.score)%")
                                .font(OpusTypography.metric)
                                .foregroundStyle(domain.score < 40 ? OpusColorPalette.rose : OpusColorPalette.primaryText)
                        }
                    }
                }

                OpusSectionHeader(title: "薄弱点", subtitle: "优先处理分数最低的节点。")

                if overview.weakNodes.isEmpty {
                    OpusStateView(
                        state: .empty(
                            title: "当前没有薄弱点",
                            message: "概览可用，但还没有需要特别关注的 L3 节点。"
                        )
                    )
                } else {
                    ForEach(overview.weakNodes) { node in
                        Button {
                            viewModel.open(.arena(path: "part5", grammarNodeID: node.id))
                        } label: {
                            OpusCard(accent: .emerald, style: .standard) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(node.name)
                                        .font(OpusTypography.cardTitle)
                                    Text(node.description)
                                        .font(OpusTypography.body)
                                        .foregroundStyle(OpusColorPalette.secondaryText)
                                    Text("掌握度 \(node.score)%")
                                        .font(OpusTypography.caption)
                                        .foregroundStyle(OpusColorPalette.warning)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                OpusSectionHeader(title: "实战模式", subtitle: "保留通往 Part 5 与 Mission 的入口。")

                Button {
                    viewModel.open(.arena(path: "part5"))
                } label: {
                    OpusCard(accent: .violet, style: .standard) {
                        Text("单句闪电战 (Part 5)")
                            .font(OpusTypography.cardTitle)
                    }
                }
                .buttonStyle(.plain)

                Button {
                    viewModel.open(.arena(path: "mission"))
                } label: {
                    OpusCard(accent: .indigo, style: .standard) {
                        Text("阅读狙击战 (Mission)")
                            .font(OpusTypography.cardTitle)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var matrixSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            OpusSectionHeader(title: "语法矩阵", subtitle: "切换领域查看 L2/L3 节点。")

            Picker("Domain", selection: $viewModel.selectedDomain) {
                Text("Verbs").tag("L1_VERBS")
                Text("Clauses").tag("L1_CLAUSES")
                Text("Connectives").tag("L1_CONNECTIVES")
                Text("Syntax").tag("L1_SPECIAL_SYNTAX")
                Text("Parts").tag("L1_PARTS_OF_SPEECH")
            }
            .pickerStyle(.menu)
            .onChange(of: viewModel.selectedDomain) { _, newValue in
                viewModel.switchDomain(newValue)
            }

            if let matrix = viewModel.matrix {
                ForEach(matrix.categories) { category in
                    OpusCard(accent: .indigo, style: .standard) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(category.l2Node.name)
                                .font(OpusTypography.sectionTitle)

                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(category.knots) { knot in
                                    Button {
                                        viewModel.selectedKnot = knot
                                    } label: {
                                        VStack(alignment: .leading, spacing: 6) {
                                            Text(knot.shortCode)
                                                .font(OpusTypography.mono)
                                            Text(knot.name)
                                                .font(OpusTypography.caption)
                                                .lineLimit(2)
                                            Text("\(knot.masteryScore)%")
                                                .font(OpusTypography.caption)
                                                .foregroundStyle(knot.masteryScore < 40 ? OpusColorPalette.rose : OpusColorPalette.secondaryText)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(12)
                                        .background(
                                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                .fill(Color.white.opacity(0.7))
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            } else {
                OpusStateView(
                    state: .empty(
                        title: "矩阵暂不可用",
                        message: "当前领域的矩阵数据还没有加载成功。"
                    )
                )
            }
        }
        .task {
            await viewModel.loadMatrix()
        }
    }

    private func destinationDescription(_ destination: DashboardDestination) -> String {
        switch destination {
        case .arena(let path, let grammarNodeID):
            if let grammarNodeID {
                return "预留 Arena `\(path)` 定向入口，grammarNodeId=`\(grammarNodeID)`。"
            }
            return "预留 Arena `\(path)` 入口。"
        default:
            return "已记录竞技场后续入口。"
        }
    }
}
