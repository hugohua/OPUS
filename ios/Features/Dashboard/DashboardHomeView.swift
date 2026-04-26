import SwiftUI

struct DashboardHomeView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let homeState: DashboardHomeState
    let onOpenDestination: (DashboardDestination) -> Void

    var body: some View {
        ZStack(alignment: .top) {
            backgroundLayer

            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: OpusSpacing.sectionSpacing) {
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
        Color(.systemGroupedBackground)
            .ignoresSafeArea()
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
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(homeState.primaryTask.accent.primaryColor)
                                .offset(x: 2)
                        }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(homeState.primaryTask.title)
                            .font(OpusTypography.cardTitle)
                            .foregroundStyle(OpusColorPalette.primaryText)

                        Text(homeState.primaryTask.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(OpusColorPalette.secondaryText)

                        OpusBadge(title: homeState.primaryTask.detail, accent: .amber, variant: .soft)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.headline)
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                }
            }
        }
        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
    }

    private var trainingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            OpusSectionHeader(title: "核心训练舱")

            LazyVGrid(columns: DashboardHomeLayout.trainingColumns(for: dynamicTypeSize), spacing: 14) {
                ForEach(Array(homeState.trainingCards.enumerated()), id: \.element.id) { index, card in
                    DashboardFeatureCardView(
                        card: card,
                        emphasis: index < 2 ? .large : .compact,
                        onTap: { onOpenDestination(card.destination) }
                    )
                }
            }
        }
    }

    private var skillsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            OpusSectionHeader(title: "技能训练")

            LazyVGrid(columns: DashboardHomeLayout.skillColumns(for: dynamicTypeSize), spacing: 14) {
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
            OpusSectionHeader(
                title: "简报中心",
                actionTitle: DashboardHomeCopy.viewAllBriefingsTitle,
                action: { onOpenDestination(.briefing(articleID: nil)) }
            )

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
}

enum DashboardHomeSection: Equatable {
    case greeting
    case memorySummary
    case primaryTask
    case training
    case skills
    case briefing
}

enum DashboardHomeLayout {
    static let visibleSections: [DashboardHomeSection] = [
        .primaryTask,
        .training,
        .skills,
        .briefing
    ]

    static func trainingColumnCount(for dynamicTypeSize: DynamicTypeSize) -> Int {
        dynamicTypeSize.isAccessibilitySize ? 1 : 2
    }

    static func skillColumnCount(for dynamicTypeSize: DynamicTypeSize) -> Int {
        dynamicTypeSize.isAccessibilitySize ? 1 : 3
    }

    static func trainingColumns(for dynamicTypeSize: DynamicTypeSize) -> [GridItem] {
        columns(count: trainingColumnCount(for: dynamicTypeSize))
    }

    static func skillColumns(for dynamicTypeSize: DynamicTypeSize) -> [GridItem] {
        columns(count: skillColumnCount(for: dynamicTypeSize))
    }

    private static func columns(count: Int) -> [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 14), count: count)
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
                VStack(alignment: .leading, spacing: emphasis == .mini ? 10 : 16) {
                    HStack(alignment: .top) {
                        iconTile
                        Spacer(minLength: 4)

                        if let badgeText = card.badgeText {
                            OpusBadge(
                                title: badgeText,
                                accent: card.accent,
                                variant: .soft,
                                size: emphasis == .mini ? .mini : .standard
                            )
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.title)
                            .font(titleFont)
                            .foregroundStyle(OpusColorPalette.primaryText)

                        Text(card.subtitle)
                            .font(subtitleFont)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)

                        if emphasis != .mini {
                            Text(card.detail)
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .buttonStyle(.opusPress(variant: .ghost, size: .icon, feel: .tactile))
    }

    private var iconTile: some View {
        RoundedRectangle(cornerRadius: emphasis == .mini ? 12 : 20, style: .continuous)
            .fill(card.accent.softColor)
            .frame(width: emphasis == .mini ? 36 : 56, height: emphasis == .mini ? 36 : 56)
            .overlay {
                Image(systemName: card.systemImage)
                    .font(emphasis == .mini ? .callout.weight(.semibold) : .title2.weight(.medium))
                    .foregroundStyle(card.accent.primaryColor)
            }
    }

    private var titleFont: Font {
        switch emphasis {
        case .large:
            return .headline
        case .compact:
            return .headline
        case .mini:
            return .subheadline.weight(.semibold)
        }
    }

    private var subtitleFont: Font {
        emphasis == .mini
            ? .caption
            : .subheadline
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

                            Text(DashboardHomeCopy.latestBriefingLabel)
                                .font(OpusTypography.mono)
                                .foregroundStyle(OpusColorPalette.tertiaryText)
                        }

                        Spacer()

                        OpusBadge(title: card.subtitle, accent: .slate, variant: .soft)
                    }

                    Text(card.title)
                        .font(OpusTypography.serifTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)
                        .fixedSize(horizontal: false, vertical: true)

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
                onOpenDestination: { _ in }
            )
            .previewDisplayName("Light")

            DashboardHomeView(
                homeState: DashboardPreviewData.longNameHomeState,
                onOpenDestination: { _ in }
            )
            .preferredColorScheme(.dark)
            .previewDevice("iPhone SE (3rd generation)")
            .previewDisplayName("Dark Small Device")
        }
    }
}
