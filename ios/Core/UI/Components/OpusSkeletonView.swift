import SwiftUI

struct OpusSkeletonView: View {
    let cornerRadius: CGFloat
    let height: CGFloat

    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(cornerRadius: CGFloat = OpusRadiusToken.lg, height: CGFloat = 16) {
        self.cornerRadius = cornerRadius
        self.height = height
    }

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(OpusColorPalette.progressTrack)
            .overlay(shimmerMask)
            .frame(height: height)
            .clipped()
            .onAppear {
                guard !reduceMotion else { return }

                withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false)) {
                    isAnimating = true
                }
            }
            .accessibilityHidden(true)
    }

    private var shimmerMask: some View {
        GeometryReader { proxy in
            LinearGradient(
                colors: [
                    .clear,
                    Color.white.opacity(0.34),
                    .clear
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: proxy.size.width * 0.42)
            .offset(x: reduceMotion ? 0 : shimmerOffset(width: proxy.size.width))
        }
        .mask(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        )
    }

    private func shimmerOffset(width: CGFloat) -> CGFloat {
        isAnimating ? width * 1.12 : -width * 0.48
    }
}
