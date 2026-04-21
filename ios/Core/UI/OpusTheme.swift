import SwiftUI

enum OpusColorPalette {
    static let background = Color(red: 0.978, green: 0.975, blue: 0.965)
    static let backgroundSecondary = Color(red: 0.992, green: 0.989, blue: 0.982)
    static let surface = Color.white.opacity(0.9)
    static let elevatedSurface = Color.white
    static let border = Color.black.opacity(0.065)
    static let primaryText = Color(red: 0.13, green: 0.13, blue: 0.16)
    static let secondaryText = Color(red: 0.44, green: 0.45, blue: 0.50)
    static let tertiaryText = Color(red: 0.66, green: 0.67, blue: 0.72)
    static let brand = Color(red: 0.41, green: 0.31, blue: 0.91)
    static let brandSoft = Color(red: 0.95, green: 0.93, blue: 1.0)
    static let success = Color(red: 0.13, green: 0.68, blue: 0.43)
    static let warning = Color(red: 0.93, green: 0.63, blue: 0.2)
    static let info = Color(red: 0.24, green: 0.48, blue: 0.95)
    static let rose = Color(red: 0.97, green: 0.31, blue: 0.47)
    static let tabBarBackground = Color.white.opacity(0.94)
    static let shadow = Color.black.opacity(0.055)
    static let shadowStrong = Color.black.opacity(0.1)
    static let progressTrack = Color(red: 0.96, green: 0.95, blue: 0.92)
}

enum OpusSpacing {
    static let screenPadding: CGFloat = 20
    static let sectionSpacing: CGFloat = 28
    static let cardPadding: CGFloat = 20
    static let cardInnerSpacing: CGFloat = 14
    static let chipPadding: CGFloat = 10
}

enum OpusCornerRadius {
    static let card: CGFloat = 24
    static let pill: CGFloat = 999
}

enum OpusTypography {
    static let pageEyebrow = Font.system(size: 12, weight: .semibold, design: .rounded)
    static let pageTitle = Font.system(size: 27, weight: .bold, design: .rounded)
    static let sectionTitle = Font.system(size: 15, weight: .semibold, design: .rounded)
    static let cardTitle = Font.system(size: 18, weight: .bold, design: .rounded)
    static let body = Font.system(size: 15, weight: .regular, design: .rounded)
    static let caption = Font.system(size: 12, weight: .medium, design: .rounded)
    static let metric = Font.system(size: 28, weight: .bold, design: .rounded)
    static let mono = Font.system(size: 12, weight: .medium, design: .monospaced)
    static let serifTitle = Font.system(size: 21, weight: .bold, design: .serif)
}

extension LinearGradient {
    static let opusBackground = LinearGradient(
        colors: [
            OpusColorPalette.backgroundSecondary,
            OpusColorPalette.background
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static let opusBrand = LinearGradient(
        colors: [
            OpusColorPalette.brand,
            Color(red: 0.29, green: 0.41, blue: 0.95)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
