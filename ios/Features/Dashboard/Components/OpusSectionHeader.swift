import SwiftUI

struct OpusSectionHeader: View {
    let title: String
    let subtitle: String?
    let actionTitle: String?

    init(title: String, subtitle: String? = nil, actionTitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(OpusTypography.sectionTitle)
                    .foregroundStyle(OpusColorPalette.tertiaryText)

                if let subtitle {
                    Text(subtitle)
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }
            }

            Spacer()

            if let actionTitle {
                Text(actionTitle)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.tertiaryText)
            }
        }
    }
}
