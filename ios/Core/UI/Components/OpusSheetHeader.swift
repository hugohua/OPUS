import SwiftUI

struct OpusSheetHeader: View {
    let title: String
    let subtitle: String?
    let closeAction: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    init(
        title: String,
        subtitle: String? = nil,
        closeAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.closeAction = closeAction
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(OpusTypography.cardTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)

                if let subtitle {
                    Text(subtitle)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer()

            Button {
                if let closeAction {
                    closeAction()
                } else {
                    dismiss()
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.opusPress(variant: .secondary, size: .iconSmall, feel: .quiet))
            .accessibilityLabel("关闭")
        }
        .padding(.bottom, 6)
    }
}
