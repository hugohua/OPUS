import SwiftUI

#if DEBUG
struct OpusDesignSystemGallery: View {
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: OpusSpacing.sectionSpacing) {
                GalleryHero()
                ColorAccentSection()
                TypographySection()
                ButtonSection()
                CardSection()
                ChipBadgeSection()
                ProgressMeterSection()
                ListRowSection()
                SheetHeaderSection()
                SkeletonSection()
                StateViewSection()
            }
            .padding(OpusSpacing.screenPadding)
        }
        .background(LinearGradient.opusBackground.ignoresSafeArea())
    }
}

private struct GalleryHero: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Design System")
                .font(OpusTypography.pageEyebrow)
                .foregroundStyle(OpusColorPalette.secondaryText)
                .textCase(.uppercase)
                .tracking(1.6)

            Text("Opus visual validation gallery")
                .font(OpusTypography.pageTitle)
                .foregroundStyle(OpusColorPalette.primaryText)

            Text("A single preview surface for color, type, controls, cards, feedback, loading, and state primitives.")
                .font(OpusTypography.body)
                .foregroundStyle(OpusColorPalette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xxl, style: .continuous)
                .fill(OpusColorPalette.elevatedSurface)
                .overlay(alignment: .topTrailing) {
                    Circle()
                        .fill(LinearGradient.opusBrand)
                        .frame(width: 132, height: 132)
                        .blur(radius: 18)
                        .opacity(0.18)
                        .offset(x: 28, y: -44)
                }
        )
        .overlay(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xxl, style: .continuous)
                .stroke(OpusColorPalette.border, lineWidth: 1)
        )
        .clipped()
    }
}

private struct ColorAccentSection: View {
    private let accents: [NamedAccent] = [
        .init("Violet", .violet),
        .init("Emerald", .emerald),
        .init("Amber", .amber),
        .init("Indigo", .indigo),
        .init("Slate", .slate),
        .init("Rose", .rose),
        .init("Blue", .blue)
    ]

    var body: some View {
        GallerySection("Color / Accent Tokens", caption: "Primary, soft, and strong swatches") {
            LazyVGrid(columns: GalleryGrid.twoColumns, spacing: 12) {
                ForEach(accents) { item in
                    AccentSwatch(item: item)
                }
            }
        }
    }
}

private struct TypographySection: View {
    private let samples: [TypeSample] = [
        .init("Eyebrow", "SYSTEM CHECK", OpusTypography.pageEyebrow),
        .init("Title", "Focus built from small wins", OpusTypography.pageTitle),
        .init("Section", "Daily training", OpusTypography.sectionTitle),
        .init("Card", "Briefing summary", OpusTypography.cardTitle),
        .init("Body", "Rounded body copy stays legible across compact cards and dense lists.", OpusTypography.body),
        .init("Caption", "Updated 4 min ago", OpusTypography.caption),
        .init("Mono", "latency=042ms", OpusTypography.mono),
        .init("Serif", "Editorial prompt", OpusTypography.serifTitle),
        .init("Metric", "92%", OpusTypography.metric)
    ]

    var body: some View {
        GallerySection("Typography Tokens", caption: "Eyebrow, title, section, card, body, caption, mono, serif, metric") {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(samples) { sample in
                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                        Text(sample.name)
                            .font(OpusTypography.mono)
                            .foregroundStyle(OpusColorPalette.tertiaryText)
                            .frame(width: 76, alignment: .leading)

                        Text(sample.text)
                            .font(sample.font)
                            .foregroundStyle(OpusColorPalette.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

private struct ButtonSection: View {
    private let buttons: [(String, OpusButtonVariant)] = [
        ("Primary", .primary),
        ("Brand", .brand),
        ("Secondary", .secondary),
        ("Outline", .outline),
        ("Ghost", .ghost),
        ("Destructive", .destructive)
    ]

    var body: some View {
        GallerySection("Buttons", caption: "Variants, sizes, icon-only, and disabled states") {
            VStack(alignment: .leading, spacing: 14) {
                LazyVGrid(columns: GalleryGrid.twoColumns, alignment: .leading, spacing: 12) {
                    ForEach(buttons, id: \.0) { title, variant in
                        Button(title) {}
                            .buttonStyle(.opusPress(variant: variant, size: .regular, feel: .tactile))
                    }
                }

                HStack(spacing: 10) {
                    Button("Small") {}
                        .buttonStyle(.opusPress(variant: .secondary, size: .small, feel: .quiet))

                    Button("Large") {}
                        .buttonStyle(.opusPress(variant: .brand, size: .large, feel: .mechanical))

                    Button {} label: {
                        Image(systemName: "sparkles")
                    }
                    .buttonStyle(.opusPress(variant: .primary, size: .icon, feel: .tactile))

                    Button("Disabled") {}
                        .buttonStyle(.opusPress(variant: .primary, size: .regular, feel: .quiet))
                        .disabled(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct CardSection: View {
    var body: some View {
        GallerySection("Cards", caption: "Standard, compact, featured, and interactive-looking surfaces") {
            VStack(spacing: 12) {
                OpusCard(accent: .violet, style: .standard) {
                    CardSampleContent(title: "Standard card", subtitle: "Balanced spacing for default content.", accent: .violet)
                }

                OpusCard(accent: .emerald, style: .compact) {
                    CardSampleContent(title: "Compact card", subtitle: "Lower emphasis surface for dense stacks.", accent: .emerald)
                }

                OpusCard(accent: .amber, style: .featured) {
                    VStack(alignment: .leading, spacing: 14) {
                        OpusBadge(title: "Featured", accent: .amber, variant: .solid)
                        CardSampleContent(title: "Featured card", subtitle: "High-signal module with an editorial title rhythm.", accent: .amber)
                    }
                }

                OpusCard(accent: .blue, style: .standard, isInteractive: true) {
                    HStack(spacing: 14) {
                        CardSampleContent(title: "Interactive card", subtitle: "Raised shadow and chevron imply a tappable surface.", accent: .blue)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundStyle(OpusAccent.blue.primaryColor)
                    }
                }
            }
        }
    }
}

private struct ChipBadgeSection: View {
    var body: some View {
        GallerySection("Chips & Badges", caption: "Active, inactive, soft, outline, solid, dot, and status") {
            VStack(alignment: .leading, spacing: 16) {
                WrappingRow {
                    OpusChip(title: "Active", accent: .violet, isActive: true, systemImage: "checkmark")
                    OpusChip(title: "Inactive", accent: .slate, isActive: false)
                    OpusChip(title: "Filter", accent: .blue, isActive: true, systemImage: "line.3.horizontal.decrease")
                }

                WrappingRow {
                    OpusBadge(title: "Soft", accent: .emerald, variant: .soft)
                    OpusBadge(title: "Outline", accent: .indigo, variant: .outline)
                    OpusBadge(title: "Solid", accent: .rose, variant: .solid)
                    OpusBadge(title: "Dot", accent: .amber, variant: .dot)
                    OpusStatusBadge(title: "READY", accent: .emerald)
                }
            }
        }
    }
}

private struct ProgressMeterSection: View {
    private let segments = [
        OpusProgressSegment(value: 42, accent: .violet),
        OpusProgressSegment(value: 28, accent: .emerald),
        OpusProgressSegment(value: 18, accent: .amber),
        OpusProgressSegment(value: 12, accent: .rose)
    ]

    var body: some View {
        GallerySection("Progress Meter", caption: "Segmented distribution, not single progress completion") {
            VStack(alignment: .leading, spacing: 14) {
                OpusProgressMeter(segments: segments, height: 14, spacing: 5)

                WrappingRow {
                    MeterLegend(title: "Grammar", value: "42%", accent: .violet)
                    MeterLegend(title: "Recall", value: "28%", accent: .emerald)
                    MeterLegend(title: "Speed", value: "18%", accent: .amber)
                    MeterLegend(title: "Review", value: "12%", accent: .rose)
                }
            }
        }
    }
}

private struct ListRowSection: View {
    var body: some View {
        GallerySection("List Rows", caption: "Normal, trailing badge, and disabled rows") {
            VStack(alignment: .leading, spacing: 18) {
                OpusListRow(
                    systemImage: "book.closed",
                    title: "Briefing queue",
                    subtitle: "Three articles ready for practice",
                    detail: "Today",
                    accent: .violet
                )

                Divider()

                OpusListRow(
                    systemImage: "bolt.fill",
                    title: "Speed drill",
                    subtitle: "Timed phrase recall",
                    accent: .amber
                ) {
                    OpusBadge(title: "New", accent: .amber, variant: .soft)
                }

                Divider()

                OpusListRow(
                    systemImage: "lock.fill",
                    title: "Advanced arena",
                    subtitle: "Unlocks after current module",
                    accent: .slate,
                    isDisabled: true
                )
            }
        }
    }
}

private struct SheetHeaderSection: View {
    var body: some View {
        GallerySection("Sheet Header Chrome", caption: "Modal title, subtitle, and close affordance") {
            OpusSheetHeader(
                title: "Training options",
                subtitle: "Tune the next session before launching the live drill.",
                closeAction: {}
            )
            .padding(18)
            .background(
                RoundedRectangle(cornerRadius: OpusRadiusToken.xl, style: .continuous)
                    .fill(OpusColorPalette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: OpusRadiusToken.xl, style: .continuous)
                    .stroke(OpusColorPalette.border, lineWidth: 1)
            )
        }
    }
}

private struct SkeletonSection: View {
    var body: some View {
        GallerySection("Skeleton Blocks", caption: "Loading placeholders with varied widths and heights") {
            VStack(alignment: .leading, spacing: 12) {
                OpusSkeletonView(cornerRadius: OpusRadiusToken.xl, height: 88)

                OpusSkeletonView(height: 18)
                    .frame(maxWidth: 260)

                OpusSkeletonView(height: 14)
                    .frame(maxWidth: 180)

                HStack(spacing: 10) {
                    OpusSkeletonView(cornerRadius: OpusRadiusToken.pill, height: 34)
                    OpusSkeletonView(cornerRadius: OpusRadiusToken.pill, height: 34)
                }
            }
        }
    }
}

private struct StateViewSection: View {
    var body: some View {
        GallerySection("State Views", caption: "Loading, empty, and error content states") {
            VStack(spacing: 12) {
                OpusStateView(
                    state: .loading,
                    loadingTitle: "Loading training snapshot",
                    loadingMessage: "Resolving local preview data."
                )

                OpusStateView(
                    state: .empty(
                        title: "No drills scheduled",
                        message: "Static sample copy keeps this gallery independent from feature models.",
                        actionTitle: "Create drill"
                    ),
                    action: {}
                )

                OpusStateView(
                    state: .error(
                        title: "Preview error",
                        message: "Use this state to validate destructive color, copy length, and action chrome.",
                        actionTitle: "Retry"
                    ),
                    action: {}
                )
            }
        }
    }
}

private struct GallerySection<Content: View>: View {
    let title: String
    let caption: String
    let content: Content

    init(_ title: String, caption: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.caption = caption
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(OpusTypography.sectionTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)

                Text(caption)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.secondaryText)
            }

            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xxl, style: .continuous)
                .fill(OpusColorPalette.elevatedSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xxl, style: .continuous)
                .stroke(OpusColorPalette.border, lineWidth: 1)
        )
    }
}

private struct AccentSwatch: View {
    let item: NamedAccent

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(item.accent.primaryColor)
                    .frame(width: 24, height: 24)

                Text(item.name)
                    .font(OpusTypography.cardTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)
            }

            HStack(spacing: 6) {
                swatch(item.accent.softColor, label: "Soft")
                swatch(item.accent.primaryColor, label: "Primary")
                swatch(item.accent.strongColor, label: "Strong")
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xl, style: .continuous)
                .fill(OpusColorPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: OpusRadiusToken.xl, style: .continuous)
                .stroke(item.accent.primaryColor.opacity(0.18), lineWidth: 1)
        )
    }

    private func swatch(_ color: Color, label: String) -> some View {
        VStack(spacing: 6) {
            RoundedRectangle(cornerRadius: OpusRadiusToken.sm, style: .continuous)
                .fill(color)
                .frame(height: 34)

            Text(label)
                .font(OpusTypography.mono)
                .foregroundStyle(OpusColorPalette.tertiaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }
}

private struct CardSampleContent: View {
    let title: String
    let subtitle: String
    let accent: OpusAccent

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(OpusTypography.cardTitle)
                .foregroundStyle(OpusColorPalette.primaryText)

            Text(subtitle)
                .font(OpusTypography.body)
                .foregroundStyle(OpusColorPalette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)

            OpusProgressMeter(
                segments: [
                    OpusProgressSegment(value: 64, accent: accent),
                    OpusProgressSegment(value: 36, accent: .slate)
                ],
                height: 7,
                spacing: 3
            )
            .padding(.top, 4)
        }
    }
}

private struct MeterLegend: View {
    let title: String
    let value: String
    let accent: OpusAccent

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(accent.primaryColor)
                .frame(width: 8, height: 8)

            Text(title)
                .font(OpusTypography.caption)
                .foregroundStyle(OpusColorPalette.secondaryText)

            Text(value)
                .font(OpusTypography.mono)
                .foregroundStyle(OpusColorPalette.primaryText)
        }
    }
}

private struct WrappingRow<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) {
                content
            }

            VStack(alignment: .leading, spacing: 10) {
                content
            }
        }
    }
}

private enum GalleryGrid {
    static let twoColumns = [
        GridItem(.adaptive(minimum: 150), spacing: 12, alignment: .topLeading)
    ]
}

private struct NamedAccent: Identifiable {
    let id: String
    let name: String
    let accent: OpusAccent

    init(_ name: String, _ accent: OpusAccent) {
        self.id = name
        self.name = name
        self.accent = accent
    }
}

private struct TypeSample: Identifiable {
    let id: String
    let name: String
    let text: String
    let font: Font

    init(_ name: String, _ text: String, _ font: Font) {
        self.id = name
        self.name = name
        self.text = text
        self.font = font
    }
}

#Preview("Design System Gallery - Light") {
    OpusDesignSystemGallery()
        .preferredColorScheme(.light)
}

#Preview("Design System Gallery - Dark") {
    OpusDesignSystemGallery()
        .preferredColorScheme(.dark)
}

#Preview("Design System Gallery - iPhone SE") {
    OpusDesignSystemGallery()
        .frame(width: 320, height: 568)
}

#Preview("Design System Gallery - Accessibility Type") {
    OpusDesignSystemGallery()
        .environment(\.dynamicTypeSize, .accessibility3)
}
#endif
