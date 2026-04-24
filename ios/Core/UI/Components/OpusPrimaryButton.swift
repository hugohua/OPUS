import SwiftUI

struct OpusPrimaryButton: View {
    let title: String
    let action: () -> Void

    init(title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.opusPress(variant: .brand, size: .large, feel: .tactile))
    }
}
