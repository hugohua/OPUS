import SwiftUI

struct OpusRevealControl: View {
    let title: String
    let onReveal: () -> Void

    init(title: String = "显示答案", onReveal: @escaping () -> Void) {
        self.title = title
        self.onReveal = onReveal
    }

    var body: some View {
        Button(action: onReveal) {
            ZStack {
                HStack {
                    Text("SPACE")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(OpusColorPalette.backgroundSecondary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(OpusColorPalette.border, lineWidth: 1)
                        )

                    Spacer()

                    Image(systemName: "rectangle")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }

                Text(title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(OpusColorPalette.primaryText)
                    .tracking(2)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(OpusColorPalette.elevatedSurface)
                    .shadow(color: OpusColorPalette.shadowStrong.opacity(0.45), radius: 0, x: 0, y: 5)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(OpusColorPalette.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct OpusFSRSGradeDeck: View {
    let preview: SessionRunnerFSRSPreview?
    let onGrade: (Int) -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            GradeButton(
                grade: 1,
                label: "忘了",
                subLabel: preview?.again,
                tint: OpusAccent.rose,
                onGrade: onGrade
            )
            GradeButton(
                grade: 2,
                label: "模糊",
                subLabel: preview?.hard,
                tint: OpusAccent.amber,
                onGrade: onGrade
            )
            GradeButton(
                grade: 3,
                label: "记得",
                subLabel: preview?.good,
                tint: OpusAccent.emerald,
                onGrade: onGrade
            )
            GradeButton(
                grade: 4,
                label: "秒记",
                subLabel: preview?.easy,
                tint: OpusAccent.blue,
                onGrade: onGrade
            )
        }
        .accessibilityElement(children: .contain)
    }

    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 2 : 4
        return Array(repeating: GridItem(.flexible(minimum: 72), spacing: 8), count: count)
    }
}

private struct GradeButton: View {
    let grade: Int
    let label: String
    let subLabel: String?
    let tint: OpusAccent
    let onGrade: (Int) -> Void

    var body: some View {
        Button {
            onGrade(grade)
        } label: {
            ZStack(alignment: .topLeading) {
                Text("\(grade)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(tint.primaryColor.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: 7) {
                    Text(label)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(tint.primaryColor)
                        .minimumScaleFactor(0.78)
                        .lineLimit(1)
                        .multilineTextAlignment(.center)

                    Text(subLabel ?? "")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(tint.primaryColor.opacity(0.65))
                        .frame(height: 15)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
            .padding(10)
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(tint.softColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(tint.primaryColor.opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label)，评分 \(grade)")
    }
}

struct OpusEtymologyCard: View {
    let etymology: SessionRunnerEtymology

    var body: some View {
        if shouldRender {
            card
                .accessibilityElement(children: .combine)
                .accessibilityLabel(accessibilityText)
        } else {
            EmptyView()
        }
    }

    private var shouldRender: Bool {
        etymology.mode != "NONE" && (!etymology.components.isEmpty || etymology.displayText != nil)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left.forwardslash.chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(OpusColorPalette.tertiaryText)

                Text("MORPHOLOGY (词根推导)")
                    .font(.caption2.monospaced().weight(.bold))
                    .tracking(1.8)
                    .foregroundStyle(OpusColorPalette.tertiaryText)
            }

            if !etymology.components.isEmpty {
                OpusEtymologyFlowLayout(horizontalSpacing: 8, verticalSpacing: 10) {
                    ForEach(Array(etymology.components.enumerated()), id: \.element.id) { index, part in
                        if index > 0 {
                            Text("+")
                                .font(.callout.monospaced().weight(.semibold))
                                .foregroundStyle(OpusColorPalette.border)
                                .padding(.top, -10)
                        }

                        OpusEtymologyToken(part: part)
                    }
                }
                .padding(.top, 2)
            }

            if let text = etymology.displayText, !text.isEmpty {
                if !etymology.components.isEmpty {
                    Divider()
                        .padding(.top, 2)
                }

                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "bolt.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(OpusAccent.indigo.primaryColor.opacity(0.8))
                        .frame(width: 16)
                        .padding(.top, 3)

                    logicText(for: text)
                        .font(.subheadline)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 18)
        .padding(.trailing, 16)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(OpusColorPalette.elevatedSurface)
                .shadow(color: OpusColorPalette.shadow.opacity(0.65), radius: 10, x: 0, y: 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(OpusColorPalette.border.opacity(0.9), lineWidth: 1)
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(OpusAccent.indigo.primaryColor.opacity(0.35))
                .frame(width: 3)
                .padding(.vertical, 1)
        }
    }

    private func logicText(for text: String) -> Text {
        let display = SessionRunnerPhraseDisplay(
            targetWord: "",
            definition: "",
            logic: text
        )

        guard display.hasSplitLogic else {
            return Text(display.logicLead)
                .foregroundColor(OpusColorPalette.primaryText)
        }

        return Text(display.logicLead)
            .foregroundColor(OpusColorPalette.secondaryText)
        + Text(" -> ")
            .font(.subheadline.monospaced())
            .foregroundColor(OpusColorPalette.tertiaryText)
        + Text(display.logicResult)
            .fontWeight(.bold)
            .foregroundColor(OpusColorPalette.primaryText)
    }

    private var accessibilityText: String {
        let parts = etymology.components
            .map { "\($0.part)\($0.meaningCN.map { "，\($0)" } ?? "")" }
            .joined(separator: "，")
        let logic = etymology.displayText ?? ""

        if parts.isEmpty {
            return "词根推导，\(logic)"
        }
        if logic.isEmpty {
            return "词根推导，\(parts)"
        }
        return "词根推导，\(parts)，\(logic)"
    }
}

private struct OpusEtymologyToken: View {
    let part: SessionRunnerEtymologyPart

    var body: some View {
        VStack(spacing: 5) {
            Text(part.part)
                .font(.callout.monospaced().weight(.bold))
                .foregroundStyle(textColor)
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(backgroundColor)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(borderColor, lineWidth: 1)
                )

            if let meaning = part.meaningCN, !meaning.isEmpty {
                Text(meaning)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(meaningColor)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.85)
            }
        }
        .multilineTextAlignment(.center)
    }

    private var tokenKind: TokenKind {
        if part.part.hasSuffix("-") {
            return .prefix
        }
        if part.part.hasPrefix("-") {
            return .suffix
        }
        return .root
    }

    private var textColor: Color {
        switch tokenKind {
        case .prefix:
            return OpusAccent.indigo.primaryColor
        case .root:
            return OpusColorPalette.primaryText
        case .suffix:
            return OpusColorPalette.secondaryText
        }
    }

    private var meaningColor: Color {
        switch tokenKind {
        case .suffix:
            return OpusColorPalette.tertiaryText
        default:
            return OpusColorPalette.secondaryText
        }
    }

    private var backgroundColor: Color {
        switch tokenKind {
        case .prefix:
            return OpusAccent.indigo.softColor
        case .root:
            return OpusColorPalette.elevatedSurface
        case .suffix:
            return OpusColorPalette.backgroundSecondary
        }
    }

    private var borderColor: Color {
        switch tokenKind {
        case .prefix:
            return OpusAccent.indigo.primaryColor.opacity(0.18)
        case .root:
            return OpusColorPalette.border
        case .suffix:
            return OpusColorPalette.border.opacity(0.65)
        }
    }

    private enum TokenKind {
        case prefix
        case root
        case suffix
    }
}

private struct OpusEtymologyFlowLayout: Layout {
    let horizontalSpacing: CGFloat
    let verticalSpacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? 0
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var measuredWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if maxWidth > 0, x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + verticalSpacing
                rowHeight = 0
            }

            measuredWidth = max(measuredWidth, x + size.width)
            x += size.width + horizontalSpacing
            rowHeight = max(rowHeight, size.height)
        }

        return CGSize(width: maxWidth > 0 ? maxWidth : measuredWidth, height: y + rowHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + verticalSpacing
                rowHeight = 0
            }

            subview.place(
                at: CGPoint(x: x, y: y),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            x += size.width + horizontalSpacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
