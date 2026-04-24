import SwiftUI

struct OpusListRow<Trailing: View>: View {
    let systemImage: String?
    let title: String
    let subtitle: String?
    let detail: String?
    let accent: OpusAccent
    let isDisabled: Bool
    let trailing: Trailing

    init(
        systemImage: String? = nil,
        title: String,
        subtitle: String? = nil,
        detail: String? = nil,
        accent: OpusAccent = .violet,
        isDisabled: Bool = false,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.systemImage = systemImage
        self.title = title
        self.subtitle = subtitle
        self.detail = detail
        self.accent = accent
        self.isDisabled = isDisabled
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: 12) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(accent.primaryColor)
                    .frame(width: 36, height: 36)
                    .background(
                        Circle()
                            .fill(accent.softColor)
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(title)
                        .font(OpusTypography.cardTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)

                    if let detail {
                        Text(detail)
                            .font(OpusTypography.caption)
                            .foregroundStyle(OpusColorPalette.tertiaryText)
                    }
                }

                if let subtitle {
                    Text(subtitle)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 12)

            trailing
        }
        .opacity(isDisabled ? 0.48 : 1)
        .allowsHitTesting(!isDisabled)
    }
}

extension OpusListRow where Trailing == EmptyView {
    init(
        systemImage: String? = nil,
        title: String,
        subtitle: String? = nil,
        detail: String? = nil,
        accent: OpusAccent = .violet,
        isDisabled: Bool = false
    ) {
        self.init(
            systemImage: systemImage,
            title: title,
            subtitle: subtitle,
            detail: detail,
            accent: accent,
            isDisabled: isDisabled
        ) {
            EmptyView()
        }
    }
}
