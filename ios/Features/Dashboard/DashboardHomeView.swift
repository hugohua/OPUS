import SwiftUI

struct DashboardHomeView: View {
    let homeState: DashboardHomeState
    let onOpenDiagnostics: () -> Void
    let onOpenDestination: (DashboardDestination) -> Void

    var body: some View {
        ZStack(alignment: .top) {
            backgroundLayer

            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: OpusSpacing.sectionSpacing) {
                    OpusDashboardHeader(
                        homeState: homeState,
                        onOpenDiagnostics: onOpenDiagnostics
                    )

                    telemetrySection

                    primaryTaskSection

                    trainingSection
                    skillsSection
                    briefingSection
                }
                .padding(.horizontal, OpusSpacing.screenPadding)
                .padding(.top, 24)
                .padding(.bottom, 128)
            }
        }
    }

    private var backgroundLayer: some View {
        LinearGradient.opusBackground
            .ignoresSafeArea()
    }

    private var telemetrySection: some View {
        return OpusCard(accent: .violet, style: .featured) {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Label("记忆遥测", systemImage: "chart.bar.xaxis")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(OpusColorPalette.secondaryText)

                    Spacer()

                    OpusStatusBadge(title: homeState.telemetryScoreText, accent: .emerald)
                }

                OpusProgressMeter(
                    segments: fsrsProgressSegments,
                    height: 14,
                    spacing: 2
                )

                HStack(spacing: 16) {
                    ForEach(Array(homeState.metrics.enumerated()), id: \.element.id) { index, metric in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(metricColor(for: index))
                                .frame(width: 9, height: 9)

                            Text(metric.title)
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.tertiaryText)

                            Text(metric.value)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(index == 2 ? OpusColorPalette.rose : OpusColorPalette.primaryText)
                        }
                    }
                }
            }
        }
    }

    private var primaryTaskSection: some View {
        Button {
            onOpenDestination(homeState.primaryTask.destination)
        } label: {
            OpusCard(accent: homeState.primaryTask.accent, style: .standard, isInteractive: true) {
                HStack(spacing: 16) {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(homeState.primaryTask.accent.softColor)
                        .frame(width: 64, height: 64)
                        .overlay {
                            Image(systemName: "play.fill")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(homeState.primaryTask.accent.primaryColor)
                                .offset(x: 2)
                        }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(homeState.primaryTask.title)
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundStyle(OpusColorPalette.primaryText)

                        Text(homeState.primaryTask.subtitle)
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundStyle(OpusColorPalette.secondaryText)

                        OpusBadge(title: homeState.primaryTask.detail, accent: .amber, variant: .soft)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                }
            }
        }
        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
    }

    private var trainingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            OpusSectionHeader(title: "核心训练舱")

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                ForEach(Array(homeState.trainingCards.enumerated()), id: \.element.id) { index, card in
                    DashboardFeatureCardView(
                        card: card,
                        emphasis: index < 2 ? .large : .compact,
                        onTap: { onOpenDestination(card.destination) }
                    )
                        .gridCellColumns(index == 2 ? 2 : 1)
                }
            }
        }
    }

    private var skillsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            OpusSectionHeader(title: "技能训练")

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                ForEach(homeState.skillCards) { card in
                    DashboardFeatureCardView(
                        card: card,
                        emphasis: .mini,
                        onTap: { onOpenDestination(card.destination) }
                    )
                }
            }
        }
    }

    private var briefingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            OpusSectionHeader(title: "简报中心 ✦", actionTitle: "View All")

            if homeState.briefingCards.isEmpty {
                OpusStateView(
                    state: .empty(
                        title: "还没有最新简报",
                        message: "首页主内容已就绪，等你第一次生成后这里会展示最新一篇。"
                    )
                )
            } else {
                ForEach(homeState.briefingCards) { card in
                    DashboardBriefingCardView(
                        card: card,
                        onTap: { onOpenDestination(card.destination) }
                    )
                }
            }
        }
    }

    private var fsrsProgressSegments: [OpusProgressSegment] {
        [
            OpusProgressSegment(value: metricValue(at: 0), color: OpusColorPalette.success),
            OpusProgressSegment(value: metricValue(at: 1), color: OpusColorPalette.warning),
            OpusProgressSegment(value: metricValue(at: 2), color: OpusColorPalette.rose)
        ]
    }

    private func metricValue(at index: Int) -> Double {
        guard homeState.metrics.indices.contains(index) else { return 0 }
        return Double(homeState.metrics[index].value) ?? 0
    }

    private func metricColor(for index: Int) -> Color {
        switch index {
        case 0:
            return OpusColorPalette.success
        case 1:
            return OpusColorPalette.warning
        default:
            return OpusColorPalette.rose
        }
    }
}

private enum DashboardFeatureEmphasis {
    case large
    case compact
    case mini
}

private struct DashboardFeatureCardView: View {
    let card: DashboardFeatureCard
    let emphasis: DashboardFeatureEmphasis
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
        } label: {
            OpusCard(accent: card.accent, style: emphasis == .mini ? .compact : .standard, isInteractive: true) {
                VStack(alignment: .leading, spacing: emphasis == .mini ? 12 : 16) {
                    HStack(alignment: .top) {
                        iconTile
                        Spacer()

                        if let badgeText = card.badgeText {
                            OpusBadge(title: badgeText, accent: card.accent, variant: .soft)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(titleFont)
                            .foregroundStyle(OpusColorPalette.primaryText)

                        Text(card.subtitle)
                            .font(subtitleFont)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                            .lineLimit(emphasis == .mini ? 2 : 1)

                        if emphasis != .mini {
                            Text(card.detail)
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }
                    }
                }
            }
        }
        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
    }

    private var iconTile: some View {
        RoundedRectangle(cornerRadius: emphasis == .mini ? 18 : 20, style: .continuous)
            .fill(card.accent.softColor)
            .frame(width: emphasis == .mini ? 50 : 56, height: emphasis == .mini ? 50 : 56)
            .overlay {
                Image(systemName: card.systemImage)
                    .font(.system(size: emphasis == .mini ? 21 : 24, weight: .medium))
                    .foregroundStyle(card.accent.primaryColor)
            }
    }

    private var titleFont: Font {
        switch emphasis {
        case .large:
            return .system(size: 17, weight: .bold, design: .rounded)
        case .compact:
            return .system(size: 18, weight: .bold, design: .rounded)
        case .mini:
            return .system(size: 15, weight: .bold, design: .rounded)
        }
    }

    private var subtitleFont: Font {
        emphasis == .mini
            ? .system(size: 12, weight: .medium, design: .rounded)
            : .system(size: 14, weight: .medium, design: .rounded)
    }
}

private struct DashboardBriefingCardView: View {
    let card: DashboardBriefingCard
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
        } label: {
            OpusCard(accent: card.accent, style: .featured, isInteractive: true) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        HStack(spacing: 10) {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(card.accent.softColor)
                                .frame(width: 44, height: 44)
                                .overlay {
                                    Image(systemName: card.systemImage)
                                        .foregroundStyle(card.accent.primaryColor)
                                }

                            Text("LATEST BRIEFING")
                                .font(OpusTypography.mono)
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }

                        Spacer()

                        OpusBadge(title: card.subtitle, accent: .slate, variant: .soft)
                    }

                    Text(card.title)
                        .font(OpusTypography.serifTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)
                        .lineLimit(1)

                    OpusBadge(title: card.contextLabel, accent: card.accent, variant: .outline)
                }
            }
        }
        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
    }
}

struct DashboardHomeView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            DashboardHomeView(
                homeState: DashboardPreviewData.defaultHomeState,
                onOpenDiagnostics: {},
                onOpenDestination: { _ in }
            )
            .previewDisplayName("Light")

            DashboardHomeView(
                homeState: DashboardPreviewData.longNameHomeState,
                onOpenDiagnostics: {},
                onOpenDestination: { _ in }
            )
            .preferredColorScheme(.dark)
            .previewDevice("iPhone SE (3rd generation)")
            .previewDisplayName("Dark Small Device")
        }
    }
}
