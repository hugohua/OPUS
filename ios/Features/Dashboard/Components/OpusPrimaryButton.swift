import SwiftUI

struct OpusPrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .background(LinearGradient.opusBrand)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
