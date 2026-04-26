import SwiftUI

struct OpusChip: View {
    let title: String
    let accent: OpusAccent
    let isActive: Bool
    let systemImage: String?
    let action: (() -> Void)?

    init(
        title: String,
        accent: OpusAccent = .violet,
        isActive: Bool = false,
        systemImage: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.accent = accent
        self.isActive = isActive
        self.systemImage = systemImage
        self.action = action
    }

    var body: some View {
        Group {
            if let action {
                Button(action: action) {
                    label
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityAddTraits(isActive ? .isSelected : [])
                .accessibilityValue(isActive ? "已选中" : "未选中")
            } else {
                label
            }
        }
        .contentShape(Capsule(style: .continuous))
    }

    private var label: some View {
        HStack(spacing: 7) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
            }

            Text(title)
                .font(OpusTypography.caption)
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Capsule(style: .continuous)
                .fill(backgroundColor)
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(borderColor, lineWidth: 1)
        )
    }

    private var foregroundColor: Color {
        isActive ? accent.primaryColor : OpusColorPalette.secondaryText
    }

    private var backgroundColor: Color {
        isActive ? accent.softColor : OpusColorPalette.surface
    }

    private var borderColor: Color {
        isActive ? accent.primaryColor.opacity(0.24) : OpusColorPalette.border
    }
}
