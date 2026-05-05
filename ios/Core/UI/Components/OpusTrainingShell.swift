import SwiftUI

struct OpusTrainingShell<Content: View, Footer: View>: View {
    let label: String
    let progress: Double
    let accent: OpusAccent
    let onExit: () -> Void
    let content: Content
    let footer: Footer

    init(
        label: String,
        progress: Double,
        accent: OpusAccent = .amber,
        onExit: @escaping () -> Void,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.label = label
        self.progress = progress
        self.accent = accent
        self.onExit = onExit
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        ZStack {
            OpusColorPalette.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                    .padding(.horizontal, OpusSpacing.screenPadding)
                    .padding(.top, 6)

                progressBar
                    .padding(.horizontal, OpusSpacing.screenPadding)
                    .padding(.top, 8)

                ScrollView(.vertical, showsIndicators: false) {
                    content
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, OpusSpacing.screenPadding)
                        .padding(.top, 28)
                        .padding(.bottom, 20)
                }
                .scrollBounceBehavior(.basedOnSize)

                footer
                    .padding(.horizontal, OpusSpacing.screenPadding)
                    .padding(.top, 10)
                    .padding(.bottom, 10)
                    .background(
                        OpusColorPalette.background
                            .ignoresSafeArea(edges: .bottom)
                    )
                    .overlay(alignment: .top) {
                        Rectangle()
                            .fill(OpusColorPalette.border.opacity(0.75))
                            .frame(height: 1)
                    }
            }
        }
    }

    private var header: some View {
        HStack {
            Button(action: onExit) {
                Image(systemName: "xmark")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(OpusColorPalette.tertiaryText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("退出训练")

            Spacer()

            HStack(spacing: 8) {
                Circle()
                    .fill(accent.primaryColor)
                    .frame(width: 8, height: 8)
                Text(label)
                    .font(.caption2.monospaced().weight(.bold))
                    .tracking(1.6)
                    .foregroundStyle(accent.primaryColor)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(OpusColorPalette.elevatedSurface)
                    .shadow(color: OpusColorPalette.shadow.opacity(0.55), radius: 8, x: 0, y: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(OpusColorPalette.border, lineWidth: 1)
            )

            Spacer()

            Color.clear
                .frame(width: 44, height: 44)
        }
    }

    private var progressBar: some View {
        GeometryReader { proxy in
            let width = max(0, min(1, progress)) * proxy.size.width
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(OpusColorPalette.progressTrack.opacity(0.8))
                Capsule(style: .continuous)
                    .fill(accent.primaryColor)
                    .frame(width: width)
            }
        }
        .frame(height: 3)
    }
}
