import SwiftUI

struct OpusStatusBadge: View {
    let title: String
    let accent: DashboardAccent

    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(accent.primaryColor.opacity(0.12))
                    .frame(width: 16, height: 16)
                    .scaleEffect(isAnimating ? 1.08 : 0.92)
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
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}
