import SwiftUI

struct OpusDashboardHeader: View {
    let homeState: DashboardHomeState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(DashboardHomeCopy.moduleEyebrow)
                .font(OpusTypography.pageEyebrow)
                .foregroundStyle(OpusColorPalette.tertiaryText)

            (
                Text("欢迎回来，")
                    .foregroundStyle(OpusColorPalette.primaryText)
                + Text(homeState.greetingName)
                    .foregroundStyle(OpusColorPalette.brand)
            )
            .font(OpusTypography.pageTitle)
            .fixedSize(horizontal: false, vertical: true)

            Text(homeState.greetingLine)
                .font(OpusTypography.body)
                .foregroundStyle(OpusColorPalette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
