import SwiftUI

struct OpusDashboardHeader: View {
    let homeState: DashboardHomeState
    let onOpenDiagnostics: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(homeState.moduleTitle.uppercased())
                        .font(OpusTypography.pageEyebrow)
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                        .tracking(1.6)

                    (
                        Text("欢迎回来，")
                            .foregroundStyle(OpusColorPalette.primaryText)
                        + Text(homeState.greetingName)
                            .foregroundStyle(OpusColorPalette.brand)
                    )
                    .font(OpusTypography.pageTitle)
                    .lineLimit(2)

                    Text(homeState.greetingLine)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }

                Spacer(minLength: 16)

                HStack(spacing: 12) {
                    CircleIconButton(
                        systemImage: "sun.max",
                        accent: .slate,
                        action: {}
                    )

                    AvatarButton(initial: String(homeState.greetingName.prefix(1)))
                        .onTapGesture(perform: onOpenDiagnostics)
                }
            }
        }
    }
}

private struct CircleIconButton: View {
    let systemImage: String
    let accent: DashboardAccent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(accent.primaryColor)
                .frame(width: 48, height: 48)
                .background(
                    Circle()
                        .fill(Color.white.opacity(0.94))
                        .overlay(Circle().stroke(OpusColorPalette.border, lineWidth: 1))
                )
        }
        .buttonStyle(.plain)
    }
}

private struct AvatarButton: View {
    let initial: String

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Circle()
                .fill(Color.black.opacity(0.88))
                .frame(width: 56, height: 56)
                .overlay(
                    Circle()
                        .stroke(OpusColorPalette.brandSoft, lineWidth: 3)
                )

            Text(initial)
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.white)

            Circle()
                .fill(OpusColorPalette.rose)
                .frame(width: 10, height: 10)
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .offset(x: 2, y: -2)
        }
        .frame(width: 56, height: 56)
    }
}
