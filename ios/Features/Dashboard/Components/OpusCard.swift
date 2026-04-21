import SwiftUI

enum OpusCardStyle {
    case standard
    case compact
    case featured
}

struct OpusCard<Content: View>: View {
    let accent: DashboardAccent
    let style: OpusCardStyle
    let content: Content

    init(
        accent: DashboardAccent = .violet,
        style: OpusCardStyle = .standard,
        @ViewBuilder content: () -> Content
    ) {
        self.accent = accent
        self.style = style
        self.content = content()
    }

    var body: some View {
        content
            .padding(OpusSpacing.cardPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                    .fill(backgroundFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                            .stroke(OpusColorPalette.border, lineWidth: 1)
                    )
            )
    }

    private var backgroundFill: Color {
        switch style {
        case .standard:
            return OpusColorPalette.elevatedSurface
        case .compact:
            return OpusColorPalette.surface
        case .featured:
            return OpusColorPalette.elevatedSurface
        }
    }
}

extension DashboardAccent {
    var primaryColor: Color {
        switch self {
        case .violet:
            return OpusColorPalette.brand
        case .emerald:
            return OpusColorPalette.success
        case .amber:
            return OpusColorPalette.warning
        case .indigo:
            return OpusColorPalette.info
        case .slate:
            return OpusColorPalette.secondaryText
        }
    }

    var softColor: Color {
        primaryColor.opacity(0.14)
    }
}
