import SwiftUI
import UIKit

enum OpusButtonVariant: CaseIterable {
    case primary
    case brand
    case secondary
    case outline
    case ghost
    case destructive
}

enum OpusButtonSize: CaseIterable {
    case small
    case regular
    case large
    case icon
    case iconSmall
}

enum OpusPressFeel {
    case quiet
    case tactile
    case mechanical
}

struct OpusPressButtonStyle: ButtonStyle {
    let variant: OpusButtonVariant
    let size: OpusButtonSize
    let feel: OpusPressFeel
    let pressedScale: CGFloat
    let pressedOpacity: Double

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        variant: OpusButtonVariant = .primary,
        size: OpusButtonSize = .regular,
        feel: OpusPressFeel = .tactile,
        pressedScale: CGFloat? = nil,
        pressedOpacity: Double? = nil
    ) {
        self.variant = variant
        self.size = size
        self.feel = feel
        self.pressedScale = pressedScale ?? feel.defaultPressedScale
        self.pressedOpacity = pressedOpacity ?? feel.defaultPressedOpacity
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundStyle(variant.foregroundStyle)
            .frame(
                minWidth: size.minWidth,
                minHeight: size.minHeight
            )
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .background(backgroundShape(isPressed: configuration.isPressed))
            .overlay(borderShape)
            .contentShape(RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous))
            .opacity(opacity(isPressed: configuration.isPressed))
            .scaleEffect(scale(isPressed: configuration.isPressed))
            .animation(animation, value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, isPressed in
                guard isEnabled, isPressed else { return }
                triggerPressFeedback()
            }
    }

    private func backgroundShape(isPressed: Bool) -> some View {
        RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
            .fill(variant.backgroundStyle)
            .opacity(variant.backgroundOpacity(isPressed: isPressed, isEnabled: isEnabled))
    }

    private var borderShape: some View {
        RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
            .stroke(variant.borderStyle, lineWidth: variant.borderWidth)
            .opacity(isEnabled ? 1 : 0.56)
    }

    private func opacity(isPressed: Bool) -> Double {
        guard isEnabled else { return 0.48 }
        return isPressed ? pressedOpacity : 1
    }

    private func scale(isPressed: Bool) -> CGFloat {
        guard isEnabled, isPressed, !reduceMotion else { return 1 }
        return pressedScale
    }

    private var animation: Animation? {
        guard !reduceMotion else { return nil }

        switch feel {
        case .quiet:
            return .easeOut(duration: OpusMotionToken.quick)
        case .tactile:
            return .smooth(duration: OpusMotionToken.quick, extraBounce: 0.08)
        case .mechanical:
            return .snappy(duration: OpusMotionToken.quick, extraBounce: 0.18)
        }
    }

    private func triggerPressFeedback() {
        switch feel {
        case .quiet:
            break
        case .tactile:
            OpusHaptics.light()
        case .mechanical:
            OpusHaptics.medium()
        }
    }
}

extension ButtonStyle where Self == OpusPressButtonStyle {
    static var opusPress: OpusPressButtonStyle {
        OpusPressButtonStyle()
    }

    static func opusPress(
        variant: OpusButtonVariant = .primary,
        size: OpusButtonSize = .regular,
        feel: OpusPressFeel = .tactile
    ) -> OpusPressButtonStyle {
        OpusPressButtonStyle(variant: variant, size: size, feel: feel)
    }
}

enum OpusHaptics {
    static func light() {
        impact(.light)
    }

    static func medium() {
        impact(.medium)
    }

    static func success() {
        notification(.success)
    }

    static func warning() {
        notification(.warning)
    }

    static func error() {
        notification(.error)
    }

    private static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }

    private static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }
}

enum OpusSensoryFeedbackEvent: Equatable {
    case light
    case medium
    case success
    case warning
    case error

    var feedback: SensoryFeedback {
        switch self {
        case .light:
            return .impact(weight: .light, intensity: 0.72)
        case .medium:
            return .impact(weight: .medium, intensity: 0.82)
        case .success:
            return .success
        case .warning:
            return .warning
        case .error:
            return .error
        }
    }
}

private struct OpusSensoryFeedbackModifier: ViewModifier {
    let event: OpusSensoryFeedbackEvent?

    func body(content: Content) -> some View {
        content
            .sensoryFeedback(event?.feedback ?? .selection, trigger: event)
    }
}

extension View {
    func opusSensoryFeedback(_ event: OpusSensoryFeedbackEvent?) -> some View {
        modifier(OpusSensoryFeedbackModifier(event: event))
    }
}

private extension OpusButtonVariant {
    var foregroundStyle: AnyShapeStyle {
        switch self {
        case .primary, .brand, .destructive:
            return AnyShapeStyle(Color.white)
        case .secondary:
            return AnyShapeStyle(OpusColorToken.accentForeground.color)
        case .outline, .ghost:
            return AnyShapeStyle(OpusColorToken.foreground.color)
        }
    }

    var backgroundStyle: AnyShapeStyle {
        switch self {
        case .primary:
            return AnyShapeStyle(OpusColorToken.primary.color)
        case .brand:
            return AnyShapeStyle(LinearGradient.opusBrand)
        case .secondary:
            return AnyShapeStyle(OpusColorToken.secondary.color)
        case .outline, .ghost:
            return AnyShapeStyle(Color.clear)
        case .destructive:
            return AnyShapeStyle(OpusColorToken.destructive.color)
        }
    }

    var borderStyle: AnyShapeStyle {
        switch self {
        case .outline:
            return AnyShapeStyle(OpusColorToken.border.color)
        case .ghost:
            return AnyShapeStyle(Color.clear)
        case .destructive:
            return AnyShapeStyle(OpusColorToken.destructive.color.opacity(0.36))
        case .primary, .brand:
            return AnyShapeStyle(OpusColorToken.ring.color.opacity(0.24))
        case .secondary:
            return AnyShapeStyle(OpusColorToken.border.color.opacity(0.82))
        }
    }

    var borderWidth: CGFloat {
        switch self {
        case .ghost:
            return 0
        case .outline:
            return 1
        case .primary, .brand, .secondary, .destructive:
            return 0.5
        }
    }

    func backgroundOpacity(isPressed: Bool, isEnabled: Bool) -> Double {
        guard isEnabled else {
            switch self {
            case .outline, .ghost:
                return 0
            case .primary, .brand, .secondary, .destructive:
                return 0.62
            }
        }

        switch self {
        case .outline, .ghost:
            return isPressed ? 0.08 : 0
        case .primary, .brand, .secondary, .destructive:
            return isPressed ? 0.9 : 1
        }
    }
}

private extension OpusButtonSize {
    var font: Font {
        switch self {
        case .small, .iconSmall:
            return .system(size: 13, weight: .semibold, design: .rounded)
        case .regular, .icon:
            return .system(size: 15, weight: .semibold, design: .rounded)
        case .large:
            return .system(size: 17, weight: .semibold, design: .rounded)
        }
    }

    var minWidth: CGFloat? {
        switch self {
        case .icon:
            return 44
        case .iconSmall:
            return 36
        case .small, .regular, .large:
            return nil
        }
    }

    var minHeight: CGFloat {
        switch self {
        case .small:
            return 34
        case .regular:
            return 42
        case .large:
            return 50
        case .icon:
            return 44
        case .iconSmall:
            return 36
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .small:
            return 12
        case .regular:
            return 16
        case .large:
            return 20
        case .icon, .iconSmall:
            return 0
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .small:
            return 6
        case .regular:
            return 9
        case .large:
            return 12
        case .icon, .iconSmall:
            return 0
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .small, .regular, .large:
            return OpusRadiusToken.lg
        case .icon, .iconSmall:
            return OpusRadiusToken.md
        }
    }
}

private extension OpusPressFeel {
    var defaultPressedScale: CGFloat {
        switch self {
        case .quiet:
            return 1
        case .tactile:
            return 0.98
        case .mechanical:
            return 0.96
        }
    }

    var defaultPressedOpacity: Double {
        switch self {
        case .quiet:
            return 0.92
        case .tactile:
            return 0.94
        case .mechanical:
            return 0.9
        }
    }
}
