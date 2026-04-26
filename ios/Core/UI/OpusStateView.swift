import SwiftUI

enum OpusContentState: Equatable {
    case loading
    case empty(title: String, message: String, actionTitle: String? = nil)
    case error(title: String, message: String, actionTitle: String)

    var title: String? {
        switch self {
        case .loading:
            return nil
        case .empty(let title, _, _), .error(let title, _, _):
            return title
        }
    }

    var message: String? {
        switch self {
        case .loading:
            return nil
        case .empty(_, let message, _), .error(_, let message, _):
            return message
        }
    }

    var actionTitle: String? {
        switch self {
        case .loading:
            return nil
        case .empty(_, _, let actionTitle):
            return actionTitle
        case .error(_, _, let actionTitle):
            return actionTitle
        }
    }
}

struct OpusStateView: View {
    let state: OpusContentState
    var loadingTitle = "正在加载"
    var loadingMessage = "请稍候。"
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            indicator

            VStack(alignment: .leading, spacing: 8) {
                Text(resolvedTitle)
                    .font(OpusTypography.cardTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)

                Text(resolvedMessage)
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let actionTitle = state.actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(OpusStateButtonStyle(state: state))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(cardBackground)
        .overlay(cardBorder)
    }

    private var resolvedTitle: String {
        state.title ?? loadingTitle
    }

    private var resolvedMessage: String {
        state.message ?? loadingMessage
    }

    @ViewBuilder
    private var indicator: some View {
        switch state {
        case .loading:
            HStack(spacing: 12) {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(OpusColorPalette.brand)

                Text("加载中")
                    .font(OpusTypography.pageEyebrow)
                    .foregroundStyle(OpusColorPalette.secondaryText)
            }
        case .empty:
            StateGlyph(
                systemImage: "tray",
                foregroundColor: OpusColorPalette.brand,
                backgroundColor: OpusColorPalette.brandSoft
            )
        case .error:
            StateGlyph(
                systemImage: "exclamationmark.triangle.fill",
                foregroundColor: OpusColorPalette.rose,
                backgroundColor: OpusColorPalette.rose.opacity(0.14)
            )
        }
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
            .fill(OpusColorPalette.surface)
            .shadow(color: OpusColorPalette.shadow, radius: 16, x: 0, y: 8)
    }

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
            .stroke(
                state == .loading ? OpusColorPalette.border : actionTint.opacity(0.18),
                lineWidth: 1
            )
    }

    private var actionTint: Color {
        switch state {
        case .error:
            return OpusColorPalette.rose
        case .loading, .empty:
            return OpusColorPalette.brand
        }
    }
}

private struct StateGlyph: View {
    let systemImage: String
    let foregroundColor: Color
    let backgroundColor: Color

    var body: some View {
        Image(systemName: systemImage)
            .font(.title3.weight(.semibold))
            .foregroundStyle(foregroundColor)
            .frame(width: 44, height: 44)
            .background(
                Circle()
                    .fill(backgroundColor)
            )
    }
}

private struct OpusStateButtonStyle: ButtonStyle {
    let state: OpusContentState

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(OpusTypography.caption)
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                Capsule(style: .continuous)
                    .fill(backgroundColor.opacity(configuration.isPressed ? 0.82 : 1))
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }

    private var foregroundColor: Color {
        switch state {
        case .error:
            return .white
        case .loading, .empty:
            return OpusColorPalette.primaryText
        }
    }

    private var backgroundColor: Color {
        switch state {
        case .error:
            return OpusColorPalette.rose
        case .loading, .empty:
            return OpusColorPalette.brandSoft
        }
    }
}

#Preview("Loading") {
    ZStack {
        LinearGradient.opusBackground
            .ignoresSafeArea()

        OpusStateView(
            state: .loading,
            loadingTitle: "正在恢复会话",
            loadingMessage: "正在检查本地登录状态。"
        )
        .padding(OpusSpacing.screenPadding)
    }
}

#Preview("Empty") {
    ZStack {
        LinearGradient.opusBackground
            .ignoresSafeArea()

        OpusStateView(
            state: .empty(
                title: "训练页暂未接入",
                message: "先保留原生骨架，等移动端 summary/list endpoint 接通后再填充真实内容。"
            )
        )
        .padding(OpusSpacing.screenPadding)
    }
}

#Preview("Error") {
    ZStack {
        LinearGradient.opusBackground
            .ignoresSafeArea()

        OpusStateView(
            state: .error(
                title: "健康检查失败",
                message: "无法连接到本地 API，请确认开发服务器仍在运行。",
                actionTitle: "重试"
            )
        )
        .padding(OpusSpacing.screenPadding)
    }
}
