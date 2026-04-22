import SwiftUI

struct AuthRootView: View {
    @Bindable var launchCoordinator: LaunchCoordinator

    var body: some View {
        NavigationStack {
            LoginView(launchCoordinator: launchCoordinator)
        }
    }
}

private struct LoginView: View {
    @Bindable var launchCoordinator: LaunchCoordinator
    @State private var email = ""
    @State private var password = ""
    @State private var fieldErrors: [String: String] = [:]
    @State private var summaryError: String?
    @State private var isSubmitting = false

    var body: some View {
        AuthScreenLayout(
            title: "Opus.",
            subtitle: "使用邮箱登录以继续访问受保护页面。"
        ) {
            VStack(alignment: .leading, spacing: 16) {
                if let authPresentationState {
                    OpusStateView(state: authPresentationState) {
                        Task {
                            await launchCoordinator.retryRestore()
                        }
                    }
                }

                AuthInputField(
                    title: "邮箱",
                    text: $email,
                    prompt: "name@example.com",
                    keyboardType: .emailAddress,
                    errorMessage: fieldErrors["email"]
                )

                AuthInputField(
                    title: "密码",
                    text: $password,
                    prompt: "请输入密码",
                    isSecure: true,
                    errorMessage: fieldErrors["password"]
                )

                if let summaryError {
                    Text(summaryError)
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.rose)
                }

                OpusPrimaryButton(title: isSubmitting ? "登录中…" : "登录") {
                    submit()
                }
                .disabled(isSubmitting)
                .opacity(isSubmitting ? 0.72 : 1)

                NavigationLink("使用邀请码注册") {
                    RegisterView(launchCoordinator: launchCoordinator)
                }
                .font(OpusTypography.caption)
                .foregroundStyle(OpusColorPalette.brand)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 4)
            }
        }
        .navigationTitle("登录")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() {
        let validationErrors = validate()
        guard validationErrors.isEmpty else {
            fieldErrors = validationErrors
            summaryError = "请先修正表单错误。"
            return
        }

        fieldErrors = [:]
        summaryError = nil
        isSubmitting = true

        Task {
            defer { isSubmitting = false }

            do {
                try await launchCoordinator.login(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password
                )
            } catch let error as AuthSessionError {
                fieldErrors = error.fieldErrors
                summaryError = error.errorDescription
            } catch {
                summaryError = error.localizedDescription
            }
        }
    }

    private func validate() -> [String: String] {
        var errors: [String: String] = [:]
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedEmail.isEmpty || !trimmedEmail.contains("@") {
            errors["email"] = "请输入有效的邮箱地址。"
        }

        if password.isEmpty {
            errors["password"] = "请输入密码。"
        }

        return errors
    }

    private var authPresentationState: OpusContentState? {
        if let lastError = launchCoordinator.lastError {
            return .error(
                title: "无法恢复会话",
                message: lastError.errorDescription ?? "请重新登录以继续。",
                actionTitle: "重试"
            )
        }

        if email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, password.isEmpty {
            return .empty(
                title: "尚未登录",
                message: "请输入邮箱密码，或使用邀请码创建新账号。"
            )
        }

        return nil
    }
}

private struct RegisterView: View {
    @Bindable var launchCoordinator: LaunchCoordinator
    @State private var inviteCode = ""
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var fieldErrors: [String: String] = [:]
    @State private var summaryError: String?
    @State private var isSubmitting = false

    var body: some View {
        AuthScreenLayout(
            title: "新用户初始化",
            subtitle: "邀请码、名称和邮箱验证通过后会直接进入主壳层。"
        ) {
            VStack(alignment: .leading, spacing: 16) {
                AuthInputField(
                    title: "邀请码",
                    text: $inviteCode,
                    prompt: "请输入邀请码",
                    errorMessage: fieldErrors["inviteCode"]
                )

                AuthInputField(
                    title: "显示名称",
                    text: $name,
                    prompt: "请输入显示名称",
                    errorMessage: fieldErrors["name"]
                )

                AuthInputField(
                    title: "邮箱",
                    text: $email,
                    prompt: "name@example.com",
                    keyboardType: .emailAddress,
                    errorMessage: fieldErrors["email"]
                )

                AuthInputField(
                    title: "密码",
                    text: $password,
                    prompt: "至少 6 位密码",
                    isSecure: true,
                    errorMessage: fieldErrors["password"]
                )

                if inviteCode.isEmpty,
                   name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                   email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                   password.isEmpty
                {
                    OpusStateView(
                        state: .empty(
                            title: "需要邀请码",
                            message: "通过邀请码、显示名称和邮箱完成初始化后会直接进入主壳层。"
                        )
                    )
                }

                if let summaryError {
                    Text(summaryError)
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.rose)
                }

                OpusPrimaryButton(title: isSubmitting ? "创建中…" : "注册并进入") {
                    submit()
                }
                .disabled(isSubmitting)
                .opacity(isSubmitting ? 0.72 : 1)
            }
        }
        .navigationTitle("注册")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() {
        let validationErrors = validate()
        guard validationErrors.isEmpty else {
            fieldErrors = validationErrors
            summaryError = "请先修正表单错误。"
            return
        }

        fieldErrors = [:]
        summaryError = nil
        isSubmitting = true

        Task {
            defer { isSubmitting = false }

            do {
                try await launchCoordinator.register(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password,
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    inviteCode: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            } catch let error as AuthSessionError {
                fieldErrors = error.fieldErrors
                summaryError = error.errorDescription
            } catch {
                summaryError = error.localizedDescription
            }
        }
    }

    private func validate() -> [String: String] {
        var errors: [String: String] = [:]
        let trimmedInviteCode = inviteCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedInviteCode.isEmpty {
            errors["inviteCode"] = "请输入邀请码。"
        }

        if trimmedName.isEmpty {
            errors["name"] = "请输入显示名称。"
        }

        if trimmedEmail.isEmpty || !trimmedEmail.contains("@") {
            errors["email"] = "请输入有效的邮箱地址。"
        }

        if password.count < 6 {
            errors["password"] = "密码至少需要 6 位。"
        }

        return errors
    }
}

private struct AuthScreenLayout<Content: View>: View {
    let title: String
    let subtitle: String
    let content: Content

    init(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        ZStack {
            LinearGradient.opusBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(title)
                            .font(OpusTypography.pageTitle)
                            .foregroundStyle(OpusColorPalette.primaryText)

                        Text(subtitle)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }

                    OpusCard(accent: .violet, style: .standard) {
                        content
                    }
                }
                .padding(OpusSpacing.screenPadding)
                .padding(.top, 28)
            }
        }
    }
}

private struct AuthInputField: View {
    let title: String
    @Binding var text: String
    let prompt: String
    var keyboardType: UIKeyboardType = .default
    var isSecure = false
    var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(OpusTypography.sectionTitle)
                .foregroundStyle(OpusColorPalette.primaryText)

            Group {
                if isSecure {
                    SecureField(prompt, text: $text)
                } else {
                    TextField(prompt, text: $text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .keyboardType(keyboardType)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(OpusColorPalette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(errorMessage == nil ? OpusColorPalette.border : OpusColorPalette.rose, lineWidth: 1)
            )

            if let errorMessage {
                Text(errorMessage)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.rose)
            }
        }
    }
}
