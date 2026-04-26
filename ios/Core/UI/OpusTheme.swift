import SwiftUI
import UIKit

enum OpusColorToken: CaseIterable {
    case background
    case foreground
    case card
    case cardForeground
    case popover
    case popoverForeground
    case primary
    case primaryForeground
    case secondary
    case secondaryForeground
    case muted
    case mutedForeground
    case accent
    case accentForeground
    case destructive
    case destructiveForeground
    case border
    case input
    case ring
    case brandCore
    case statusReady
    case statusWarn
    case statusLock
    case syntaxSubject
    case syntaxVerb
    case syntaxObject
    case syntaxOther
    case chart1
    case chart2
    case chart3
    case chart4
    case chart5

    var color: Color {
        Color(uiColor)
    }

    var uiColor: UIColor {
        switch self {
        case .background:
            return .opusDynamic(light: .hsl(0, 0, 98), dark: .hsl(240, 10, 3.9))
        case .foreground:
            return .opusDynamic(light: .hsl(240, 10, 3.9), dark: .hsl(0, 0, 98))
        case .card:
            return .opusDynamic(light: .hsl(0, 0, 100), dark: .hsl(240, 10, 3.9))
        case .cardForeground:
            return .opusDynamic(light: .hsl(240, 10, 3.9), dark: .hsl(0, 0, 98))
        case .popover:
            return .opusDynamic(light: .hsl(0, 0, 100), dark: .hsl(240, 10, 3.9))
        case .popoverForeground:
            return .opusDynamic(light: .hsl(240, 10, 3.9), dark: .hsl(0, 0, 98))
        case .primary:
            return .opusDynamic(light: .hsl(262.1, 83.3, 57.8), dark: .hsl(263.4, 70, 50.4))
        case .primaryForeground:
            return .opusStatic(.hsl(0, 0, 100))
        case .secondary:
            return .opusDynamic(light: .hsl(240, 4.8, 95.9), dark: .hsl(240, 3.7, 15.9))
        case .secondaryForeground:
            return .opusDynamic(light: .hsl(240, 3.8, 46.1), dark: .hsl(240, 5, 64.9))
        case .muted:
            return .opusDynamic(light: .hsl(240, 4.8, 95.9), dark: .hsl(240, 3.7, 15.9))
        case .mutedForeground:
            return .opusDynamic(light: .hsl(240, 3.8, 46.1), dark: .hsl(240, 5, 64.9))
        case .accent:
            return .opusDynamic(light: .hsl(240, 4.8, 95.9), dark: .hsl(240, 3.7, 15.9))
        case .accentForeground:
            return .opusDynamic(light: .hsl(240, 5.9, 10), dark: .hsl(0, 0, 98))
        case .destructive:
            return .opusDynamic(light: .hsl(0, 84.2, 60.2), dark: .hsl(0, 62.8, 30.6))
        case .destructiveForeground:
            return .opusStatic(.hsl(0, 0, 98))
        case .border:
            return .opusDynamic(light: .hsl(240, 5.9, 90), dark: .hsl(240, 3.7, 15.9))
        case .input:
            return .opusDynamic(light: .hsl(240, 5.9, 90), dark: .hsl(240, 3.7, 15.9))
        case .ring:
            return .opusDynamic(light: .hsl(262.1, 83.3, 57.8), dark: .hsl(263.4, 70, 50.4))
        case .brandCore:
            return .opusDynamic(light: .hsl(262.1, 83.3, 57.8), dark: .hsl(263.4, 70, 50.4))
        case .statusReady:
            return .opusDynamic(light: .hsl(158, 64, 52), dark: .hsl(158.1, 64.4, 51.6))
        case .statusWarn:
            return .opusStatic(.hsl(37.7, 92.1, 50.2))
        case .statusLock:
            return .opusDynamic(light: .hsl(240, 5, 65), dark: .hsl(240, 5.2, 33.9))
        case .syntaxSubject:
            return .opusDynamic(light: .hsl(159, 64, 45), dark: .hsl(154.9, 74.3, 66.9))
        case .syntaxVerb:
            return .opusDynamic(light: .hsl(343, 88, 54), dark: .hsl(343, 96, 76))
        case .syntaxObject:
            return .opusDynamic(light: .hsl(204, 94, 48), dark: .hsl(204.2, 92, 75))
        case .syntaxOther:
            return .opusDynamic(light: .hsl(240, 5, 65), dark: .hsl(240, 5, 64.9))
        case .chart1:
            return .opusDynamic(light: .hsl(12, 76, 61), dark: .hsl(220, 70, 50))
        case .chart2:
            return .opusDynamic(light: .hsl(173, 58, 39), dark: .hsl(160, 60, 45))
        case .chart3:
            return .opusDynamic(light: .hsl(197, 37, 24), dark: .hsl(30, 80, 55))
        case .chart4:
            return .opusDynamic(light: .hsl(43, 74, 66), dark: .hsl(280, 65, 60))
        case .chart5:
            return .opusDynamic(light: .hsl(27, 87, 67), dark: .hsl(340, 75, 55))
        }
    }
}

enum OpusAccent: String, CaseIterable {
    case violet
    case emerald
    case amber
    case indigo
    case slate
    case rose
    case blue

    var primaryColor: Color {
        primaryToken.color
    }

    var softColor: Color {
        switch self {
        case .violet:
            return OpusSemanticColors.violetSoft
        case .emerald:
            return OpusSemanticColors.emeraldSoft
        case .amber:
            return OpusSemanticColors.amberSoft
        case .indigo:
            return OpusSemanticColors.indigoSoft
        case .slate:
            return OpusSemanticColors.slateSoft
        case .rose:
            return OpusSemanticColors.roseSoft
        case .blue:
            return OpusSemanticColors.blueSoft
        }
    }

    var strongColor: Color {
        switch self {
        case .violet:
            return OpusSemanticColors.violetStrong
        case .emerald:
            return OpusSemanticColors.emeraldStrong
        case .amber:
            return OpusSemanticColors.amberStrong
        case .indigo:
            return OpusSemanticColors.indigoStrong
        case .slate:
            return OpusSemanticColors.slateStrong
        case .rose:
            return OpusSemanticColors.roseStrong
        case .blue:
            return OpusSemanticColors.blueStrong
        }
    }

    private var primaryToken: OpusColorToken {
        switch self {
        case .violet:
            return .brandCore
        case .emerald:
            return .statusReady
        case .amber:
            return .statusWarn
        case .indigo, .blue:
            return .syntaxObject
        case .slate:
            return .mutedForeground
        case .rose:
            return .syntaxVerb
        }
    }
}

enum OpusSpacingToken {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 28
    static let xxxl: CGFloat = 32
}

enum OpusRadiusToken {
    static let sm: CGFloat = 8
    static let md: CGFloat = 10
    static let lg: CGFloat = 12
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let pill: CGFloat = 999
}

enum OpusTypographyToken {
    static let eyebrow = Font.caption.weight(.semibold)
    static let title = Font.title2.weight(.bold)
    static let heading = Font.headline
    static let subheading = Font.subheadline.weight(.semibold)
    static let body = Font.body
    static let caption = Font.caption
    static let metric = Font.title2.monospacedDigit().weight(.bold)
    static let mono = Font.caption.monospaced().weight(.medium)
    static let editorialTitle = Font.system(.title3, design: .serif, weight: .semibold)
}

enum OpusElevationToken {
    static let shadow = OpusShadow(color: OpusColorPalette.shadow, radius: 16, x: 0, y: 8)
    static let shadowStrong = OpusShadow(color: OpusColorPalette.shadowStrong, radius: 24, x: 0, y: 14)
}

struct OpusShadow {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

enum OpusMotionToken {
    static let quick: TimeInterval = 0.18
    static let standard: TimeInterval = 0.28
    static let emphasized: TimeInterval = 0.42
}

// Compatibility facade for existing SwiftUI screens.
enum OpusColorPalette {
    static let background = OpusColorToken.background.color
    static let backgroundSecondary = OpusColorToken.secondary.color
    static let surface = OpusSemanticColors.surface
    static let elevatedSurface = OpusColorToken.card.color
    static let border = OpusColorToken.border.color
    static let primaryText = OpusColorToken.foreground.color
    static let secondaryText = OpusColorToken.mutedForeground.color
    static let tertiaryText = OpusColorToken.statusLock.color
    static let brand = OpusColorToken.brandCore.color
    static let brandSoft = OpusSemanticColors.violetSoft
    static let success = OpusColorToken.statusReady.color
    static let warning = OpusColorToken.statusWarn.color
    static let info = OpusColorToken.syntaxObject.color
    static let rose = OpusColorToken.syntaxVerb.color
    static let tabBarBackground = OpusSemanticColors.tabBarBackground
    static let shadow = OpusSemanticColors.shadow
    static let shadowStrong = OpusSemanticColors.shadowStrong
    static let progressTrack = OpusColorToken.muted.color
}

enum OpusSpacing {
    static let screenPadding = OpusSpacingToken.lg
    static let sectionSpacing = OpusSpacingToken.xxl
    static let cardPadding = OpusSpacingToken.lg
    static let cardInnerSpacing: CGFloat = 14
    static let chipPadding = OpusSpacingToken.md - OpusSpacingToken.xs + 2
}

enum OpusCornerRadius {
    static let card = OpusRadiusToken.lg
    static let pill = OpusRadiusToken.pill
}

enum OpusTypography {
    static let pageEyebrow = OpusTypographyToken.eyebrow
    static let pageTitle = OpusTypographyToken.title
    static let sectionTitle = OpusTypographyToken.subheading
    static let cardTitle = OpusTypographyToken.heading
    static let body = OpusTypographyToken.body
    static let caption = OpusTypographyToken.caption
    static let metric = OpusTypographyToken.metric
    static let mono = OpusTypographyToken.mono
    static let serifTitle = OpusTypographyToken.editorialTitle
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
            OpusAccent.violet.primaryColor,
            OpusAccent.blue.primaryColor
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

private enum OpusSemanticColors {
    static let surface = Color(.opusDynamic(light: .hsl(0, 0, 100, alpha: 0.9), dark: .hsl(240, 3.7, 15.9, alpha: 0.86)))
    static let tabBarBackground = Color(.opusDynamic(light: .hsl(0, 0, 100, alpha: 0.94), dark: .hsl(240, 10, 3.9, alpha: 0.92)))
    static let shadow = Color(.opusDynamic(light: .hsl(0, 0, 0, alpha: 0.055), dark: .hsl(0, 0, 0, alpha: 0.35)))
    static let shadowStrong = Color(.opusDynamic(light: .hsl(0, 0, 0, alpha: 0.1), dark: .hsl(0, 0, 0, alpha: 0.55)))

    static let violetSoft = Color(.opusDynamic(light: .hsl(262.1, 83.3, 96), dark: .hsl(263.4, 70, 18)))
    static let emeraldSoft = Color(.opusDynamic(light: .hsl(158, 64, 94), dark: .hsl(158.1, 64.4, 16)))
    static let amberSoft = Color(.opusDynamic(light: .hsl(37.7, 92.1, 94), dark: .hsl(37.7, 92.1, 16)))
    static let indigoSoft = Color(.opusDynamic(light: .hsl(204, 94, 95), dark: .hsl(204.2, 92, 18)))
    static let slateSoft = Color(.opusDynamic(light: .hsl(240, 4.8, 95.9), dark: .hsl(240, 3.7, 15.9)))
    static let roseSoft = Color(.opusDynamic(light: .hsl(343, 88, 95), dark: .hsl(343, 88, 18)))
    static let blueSoft = Color(.opusDynamic(light: .hsl(204, 94, 95), dark: .hsl(204.2, 92, 18)))

    static let violetStrong = Color(.opusDynamic(light: .hsl(262.1, 83.3, 45), dark: .hsl(263.4, 70, 62)))
    static let emeraldStrong = Color(.opusDynamic(light: .hsl(159, 64, 36), dark: .hsl(154.9, 74.3, 66.9)))
    static let amberStrong = Color(.opusDynamic(light: .hsl(37.7, 92.1, 42), dark: .hsl(37.7, 92.1, 62)))
    static let indigoStrong = Color(.opusDynamic(light: .hsl(204, 94, 40), dark: .hsl(204.2, 92, 75)))
    static let slateStrong = Color(.opusDynamic(light: .hsl(240, 5.9, 10), dark: .hsl(0, 0, 98)))
    static let roseStrong = Color(.opusDynamic(light: .hsl(343, 88, 44), dark: .hsl(343, 96, 76)))
    static let blueStrong = Color(.opusDynamic(light: .hsl(204, 94, 40), dark: .hsl(204.2, 92, 75)))
}

private extension UIColor {
    static func opusDynamic(light: UIColor, dark: UIColor) -> UIColor {
        UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark ? dark : light
        }
    }

    static func opusStatic(_ color: UIColor) -> UIColor {
        color
    }

    static func hsl(_ hue: CGFloat, _ saturation: CGFloat, _ lightness: CGFloat, alpha: CGFloat = 1) -> UIColor {
        let h = hue / 360
        let s = saturation / 100
        let l = lightness / 100

        guard s > 0 else {
            return UIColor(red: l, green: l, blue: l, alpha: alpha)
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s
        let p = 2 * l - q

        return UIColor(
            red: hueToRGB(p: p, q: q, t: h + 1 / 3),
            green: hueToRGB(p: p, q: q, t: h),
            blue: hueToRGB(p: p, q: q, t: h - 1 / 3),
            alpha: alpha
        )
    }

    private static func hueToRGB(p: CGFloat, q: CGFloat, t: CGFloat) -> CGFloat {
        var t = t
        if t < 0 { t += 1 }
        if t > 1 { t -= 1 }
        if t < 1 / 6 { return p + (q - p) * 6 * t }
        if t < 1 / 2 { return q }
        if t < 2 / 3 { return p + (q - p) * (2 / 3 - t) * 6 }
        return p
    }
}
