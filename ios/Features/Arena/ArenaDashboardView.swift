import SwiftUI

struct ArenaDashboardView: View {
    @Bindable var viewModel: ArenaDashboardViewModel
    let pendingDestination: DashboardDestination?
    let makeArenaPart5ViewModel: (String?) -> ArenaPart5ViewModel
    let makeArenaMissionViewModel: () -> ArenaMissionViewModel

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
            .background(arenaNavigationLink)
        }
        .task {
            await viewModel.loadOverview()
            routePendingDestinationIfNeeded()
        }
        .onChange(of: pendingDestination) { _, _ in
            routePendingDestinationIfNeeded()
        }
        .sheet(item: $viewModel.selectedKnot) { knot in
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    OpusSheetHeader(
                        title: knot.name,
                        subtitle: knot.nameEn ?? "No English name"
                    )

                    HStack(spacing: 10) {
                        OpusBadge(
                            title: "掌握度 \(knot.masteryScore)%",
                            accent: masteryAccent(knot.masteryScore),
                            variant: .dot
                        )
                        OpusBadge(title: "题量 \(knot.availableQs)", accent: .blue, variant: .soft)
                    }

                    OpusPrimaryButton(title: "开始 Part 5 定向训练") {
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
                        VStack(alignment: .leading, spacing: 10) {
                            OpusStatusBadge(title: "ROUTING", accent: .amber)
                            Text(destinationDescription(activeDestination))
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                        }
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
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(domain.label)
                                        .font(OpusTypography.sectionTitle)
                                    Text(domain.code)
                                        .font(OpusTypography.caption)
                                        .foregroundStyle(OpusColorPalette.secondaryText)
                                }

                                Spacer()

                                OpusBadge(
                                    title: "\(domain.score)%",
                                    accent: masteryAccent(domain.score),
                                    variant: .soft
                                )
                            }

                            OpusProgressMeter(
                                segments: radarSegments(for: domain.score),
                                height: 10,
                                spacing: 0
                            )
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
                            OpusCard(accent: masteryAccent(node.score), style: .standard, isInteractive: true) {
                                OpusListRow(
                                    systemImage: "exclamationmark.triangle.fill",
                                    title: node.name,
                                    subtitle: node.description,
                                    caption: "点击进入 Part 5 定向训练",
                                    accent: masteryAccent(node.score)
                                ) {
                                    OpusBadge(
                                        title: "\(node.score)%",
                                        accent: masteryAccent(node.score),
                                        variant: .soft
                                    )
                                }
                            }
                        }
                        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
                    }
                }

                OpusSectionHeader(title: "实战模式", subtitle: "保留通往 Part 5 与 Mission 的入口。")

                Button {
                    viewModel.open(.arena(path: "part5"))
                } label: {
                    OpusCard(accent: .violet, style: .standard, isInteractive: true) {
                        OpusListRow(
                            systemImage: "bolt.fill",
                            title: "单句闪电战",
                            subtitle: "Part 5 定向训练",
                            caption: "进入语法单句练习",
                            accent: .violet
                        ) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }
                    }
                }
                .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))

                Button {
                    viewModel.open(.arena(path: "mission"))
                } label: {
                    OpusCard(accent: .indigo, style: .standard, isInteractive: true) {
                        OpusListRow(
                            systemImage: "scope",
                            title: "阅读狙击战",
                            subtitle: "Mission",
                            caption: "进入阅读任务练习",
                            accent: .indigo
                        ) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }
                    }
                }
                .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
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
                                        OpusCard(accent: masteryAccent(knot.masteryScore), style: .compact, isInteractive: true) {
                                            VStack(alignment: .leading, spacing: 8) {
                                                HStack(alignment: .firstTextBaseline) {
                                                    Text(knot.shortCode)
                                                        .font(OpusTypography.mono)
                                                        .foregroundStyle(OpusColorPalette.secondaryText)

                                                    Spacer(minLength: 8)

                                                    OpusBadge(
                                                        title: "\(knot.masteryScore)%",
                                                        accent: masteryAccent(knot.masteryScore),
                                                        variant: .soft
                                                    )
                                                }

                                                Text(knot.name)
                                                    .font(OpusTypography.caption)
                                                    .foregroundStyle(OpusColorPalette.primaryText)
                                                    .lineLimit(2)

                                                OpusBadge(title: "\(knot.availableQs) 题", accent: .blue, variant: .outline)
                                            }
                                        }
                                    }
                                    .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
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
                return "即将进入 Arena `\(path)` 定向训练，grammarNodeId=`\(grammarNodeID)`。"
            }
            return "即将进入 Arena `\(path)`。"
        default:
            return "已记录竞技场后续入口。"
        }
    }

    private func masteryAccent(_ score: Int) -> OpusAccent {
        if score < 40 { return .rose }
        if score < 70 { return .amber }
        return .emerald
    }

    private func radarSegments(for score: Int) -> [OpusProgressSegment] {
        [
            OpusProgressSegment(value: Double(score), accent: masteryAccent(score)),
            OpusProgressSegment(value: Double(max(0, 100 - score)), color: OpusColorPalette.progressTrack)
        ]
    }

    private var arenaNavigationLink: some View {
        NavigationLink(
            isActive: Binding(
                get: { viewModel.activeDestination != nil },
                set: { isActive in
                    if !isActive {
                        viewModel.activeDestination = nil
                    }
                }
            )
        ) {
            if let destination = viewModel.activeDestination {
                switch destination {
                case .arena(let path, let grammarNodeID):
                    if path == "mission" {
                        ArenaMissionView(viewModel: makeArenaMissionViewModel())
                    } else {
                        ArenaPart5View(viewModel: makeArenaPart5ViewModel(grammarNodeID))
                    }
                default:
                    EmptyView()
                }
            } else {
                EmptyView()
            }
        } label: {
            EmptyView()
        }
    }

    private func routePendingDestinationIfNeeded() {
        guard let pendingDestination else { return }
        if viewModel.activeDestination != pendingDestination {
            viewModel.open(pendingDestination)
        }
    }
}
