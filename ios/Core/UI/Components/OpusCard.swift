import SwiftUI

enum OpusCardStyle {
    case standard
    case compact
    case featured
}

struct OpusCard<Content: View>: View {
    let accent: OpusAccent
    let style: OpusCardStyle
    let isInteractive: Bool
    let content: Content

    init(
        accent: OpusAccent = .violet,
        style: OpusCardStyle = .standard,
        isInteractive: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.accent = accent
        self.style = style
        self.isInteractive = isInteractive
        self.content = content()
    }

    var body: some View {
        content
            .padding(style == .compact ? 14 : OpusSpacing.cardPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(cardBackground)
            .overlay(cardBorder)
            .contentShape(RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous))
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
            .fill(backgroundFill)
    }

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
            .stroke(OpusColorPalette.border, lineWidth: 1)
    }

    private var backgroundFill: Color {
        switch style {
        case .standard, .featured:
            return OpusColorPalette.elevatedSurface
        case .compact:
            return OpusColorPalette.surface
        }
    }

}
