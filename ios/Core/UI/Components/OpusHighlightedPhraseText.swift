import SwiftUI

enum OpusHighlightedPhraseTextStyle {
    case phrase
    case definition

    var regularFont: Font {
        switch self {
        case .phrase:
            return .system(.title, design: .serif).weight(.regular)
        case .definition:
            return .body.weight(.medium)
        }
    }

    var highlightedFont: Font {
        switch self {
        case .phrase:
            return .system(.title, design: .serif).weight(.bold)
        case .definition:
            return .body.weight(.bold)
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .phrase:
            return 8
        case .definition:
            return 6
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .phrase:
            return 5
        case .definition:
            return 3
        }
    }
}

struct OpusHighlightedPhraseText: View {
    let markdown: String
    let style: OpusHighlightedPhraseTextStyle

    init(markdown: String, style: OpusHighlightedPhraseTextStyle = .phrase) {
        self.markdown = markdown
        self.style = style
    }

    var body: some View {
        OpusFlowLayout(horizontalSpacing: 6, verticalSpacing: 8) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                if token.isHighlighted {
                    Text(token.text)
                        .font(style.highlightedFont)
                        .foregroundStyle(OpusAccent.indigo.primaryColor)
                        .padding(.horizontal, style.horizontalPadding)
                        .padding(.vertical, style.verticalPadding)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(OpusAccent.indigo.softColor)
                                .rotationEffect(.degrees(-2))
                        )
                } else {
                    Text(token.text)
                        .font(style.regularFont)
                        .foregroundStyle(OpusColorPalette.primaryText)
                }
            }
        }
    }

    private var tokens: [PhraseTextToken] {
        PhraseTextToken.parse(markdown)
    }
}

private struct PhraseTextToken {
    let text: String
    let isHighlighted: Bool

    static func parse(_ markdown: String) -> [PhraseTextToken] {
        var result: [PhraseTextToken] = []
        var remaining = markdown[...]

        while let open = remaining.range(of: "**") {
            appendPlainText(String(remaining[..<open.lowerBound]), to: &result)
            remaining = remaining[open.upperBound...]

            guard let close = remaining.range(of: "**") else {
                appendPlainText(String(remaining), to: &result)
                return result
            }

            let highlighted = String(remaining[..<close.lowerBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !highlighted.isEmpty {
                result.append(PhraseTextToken(text: highlighted, isHighlighted: true))
            }
            remaining = remaining[close.upperBound...]
        }

        appendPlainText(String(remaining), to: &result)
        return result
    }

    private static func appendPlainText(_ text: String, to result: inout [PhraseTextToken]) {
        let parts = text
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
        result.append(contentsOf: parts.map { PhraseTextToken(text: $0, isHighlighted: false) })
    }
}

private struct OpusFlowLayout: Layout {
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
