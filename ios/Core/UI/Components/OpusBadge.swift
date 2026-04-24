import SwiftUI

enum OpusBadgeVariant {
    case soft
    case outline
    case solid
    case dot
}

struct OpusBadge: View {
    let title: String
    let accent: OpusAccent
    let variant: OpusBadgeVariant

    init(
        title: String,
        accent: OpusAccent = .violet,
        variant: OpusBadgeVariant = .soft
    ) {
        self.title = title
        self.accent = accent
        self.variant = variant
    }

    var body: some View {
        HStack(spacing: 7) {
            if variant == .dot {
                Circle()
                    .fill(accent.primaryColor)
                    .frame(width: 7, height: 7)
            }

            Text(title)
                .font(OpusTypography.caption)
                .foregroundStyle(foregroundColor)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background(background)
        .overlay(border)
    }

    private var background: some View {
        Capsule(style: .continuous)
            .fill(backgroundColor)
    }

    private var border: some View {
        Capsule(style: .continuous)
            .stroke(borderColor, lineWidth: 1)
    }

    private var foregroundColor: Color {
        switch variant {
        case .solid:
            return .white
        case .soft, .outline, .dot:
            return accent.primaryColor
        }
    }

    private var backgroundColor: Color {
        switch variant {
        case .soft, .dot:
            return accent.softColor.opacity(0.9)
        case .outline:
            return Color.clear
        case .solid:
            return accent.primaryColor
        }
    }

    private var borderColor: Color {
        switch variant {
        case .outline:
            return accent.primaryColor.opacity(0.32)
        case .soft, .dot:
            return accent.primaryColor.opacity(0.18)
        case .solid:
            return accent.primaryColor.opacity(0.12)
        }
    }
}

struct OpusStatusBadge: View {
    let title: String
    let accent: OpusAccent

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isAnimating = false

    init(title: String, accent: OpusAccent) {
        self.title = title
        self.accent = accent
    }

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(accent.primaryColor.opacity(0.12))
                    .frame(width: 16, height: 16)
                    .scaleEffect(reduceMotion ? 1 : (isAnimating ? 1.08 : 0.92))
                Circle()
                    .fill(accent.primaryColor)
                    .frame(width: 7, height: 7)
            }

            Text(title)
                .font(OpusTypography.mono)
                .foregroundStyle(accent.primaryColor)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(
            Capsule(style: .continuous)
                .fill(accent.softColor.opacity(0.9))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(accent.primaryColor.opacity(0.18), lineWidth: 1)
                )
        )
        .onAppear {
            guard !reduceMotion else {
                isAnimating = false
                return
            }

            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
        .onChange(of: reduceMotion) { _, newValue in
            if newValue {
                isAnimating = false
            }
        }
    }
}
