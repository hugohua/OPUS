import SwiftUI

struct DiagnosticsHomeView: View {
    @Bindable var viewModel: DiagnosticsViewModel

    var body: some View {
        NavigationStack {
            List {
                Section("Environment") {
                    LabeledContent("Environment", value: viewModel.runtimeConfig.appEnvironment.title)
                    LabeledContent("Base URL", value: viewModel.runtimeConfig.apiBaseURL.absoluteString)
                    LabeledContent(
                        "Network Logging",
                        value: viewModel.runtimeConfig.networkLoggingEnabled ? "Enabled" : "Disabled"
                    )
                    LabeledContent(
                        "ATS Local HTTP",
                        value: viewModel.runtimeConfig.allowsInsecureLocalLoads ? "Allowed" : "Strict"
                    )
                    LabeledContent("Token", value: viewModel.tokenStatusText)
                }

                Section("Build") {
                    LabeledContent("Display Name", value: viewModel.buildInfo.displayName)
                    LabeledContent("Bundle ID", value: viewModel.buildInfo.bundleIdentifier)
                    LabeledContent("Version", value: viewModel.buildInfo.appVersion)
                    LabeledContent("Build", value: viewModel.buildInfo.buildNumber)
                    LabeledContent("Device", value: viewModel.buildInfo.deviceName)
                    LabeledContent("iOS", value: viewModel.buildInfo.systemVersion)
                }

                Section("Health Check") {
                    if let healthState {
                        OpusStateView(
                            state: healthState,
                            loadingTitle: "正在检查服务状态",
                            loadingMessage: "这会请求移动端 health endpoint。"
                        ) {
                            Task {
                                await viewModel.runHealthCheck()
                            }
                        }
                    } else if let payload = viewModel.latestHealthPayload {
                        LabeledContent("Status", value: viewModel.healthStatusTitle)
                        LabeledContent("Server Env", value: payload.env)
                        LabeledContent("Server Version", value: payload.version)
                        LabeledContent("Timestamp", value: payload.timestamp)
                    }
                }

                Section("Actions") {
                    Button("Run Health Check") {
                        Task {
                            await viewModel.runHealthCheck()
                        }
                    }

                    Button("Reload Config") {
                        viewModel.reloadConfig()
                    }

                    Button("Clear Stored Token", role: .destructive) {
                        Task {
                            await viewModel.clearStoredToken()
                        }
                    }
                    .disabled(viewModel.isPerformingAction)

                    if let actionFeedback = viewModel.actionFeedback {
                        Text(actionFeedback.message)
                            .font(OpusTypography.caption)
                            .foregroundStyle(actionFeedbackColor(for: actionFeedback))
                    }
                }
            }
            .navigationTitle("OPUS Diagnostics")
        }
    }

    private var healthState: OpusContentState? {
        if viewModel.isRunningHealthCheck {
            return .loading
        }

        if let lastError = viewModel.lastHealthCheckError {
            return .error(
                title: "健康检查失败",
                message: lastError,
                actionTitle: "重试"
            )
        }

        guard viewModel.latestHealthPayload == nil else {
            return nil
        }

        return .empty(
            title: "尚未执行健康检查",
            message: "点击下方按钮或当前卡片操作，验证移动端 API 是否可用。",
            actionTitle: "立即检查"
        )
    }

    private func actionFeedbackColor(for feedback: DiagnosticsActionFeedback) -> Color {
        switch feedback {
        case .inProgress:
            return OpusColorPalette.secondaryText
        case .success:
            return OpusColorPalette.brand
        case .failure:
            return OpusColorPalette.rose
        }
    }
}

#Preview {
    DiagnosticsHomeView(
        viewModel: DiagnosticsViewModel(
            runtimeConfigLoader: { .fallbackLocal },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: KeychainTokenStore(service: "preview", account: "preview"),
            healthService: HealthCheckService(apiClient: PreviewAPIClient()),
            clearStoredTokenAction: nil
        )
    )
}

#Preview("Diagnostics Error") {
    let viewModel = DiagnosticsViewModel(
        runtimeConfigLoader: { .fallbackLocal },
        buildInfoProvider: { BuildInfo.current() },
        tokenStore: KeychainTokenStore(service: "preview", account: "preview"),
        healthService: HealthCheckService(apiClient: PreviewAPIClient()),
        clearStoredTokenAction: nil
    )
    viewModel.lastHealthCheckError = "无法连接到 http://localhost:3000。"

    return DiagnosticsHomeView(viewModel: viewModel)
}

private struct PreviewAPIClient: APIClient {
    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T : Decodable {
        HealthCheckPayload(
            status: "ok",
            timestamp: "2026-04-19T00:00:00Z",
            env: "local",
            version: "1.0.0"
        ) as! T
    }
}
