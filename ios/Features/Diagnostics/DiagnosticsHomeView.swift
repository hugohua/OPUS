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
                    LabeledContent("Status", value: viewModel.healthStatusTitle)

                    if let payload = viewModel.latestHealthPayload {
                        LabeledContent("Server Env", value: payload.env)
                        LabeledContent("Server Version", value: payload.version)
                        LabeledContent("Timestamp", value: payload.timestamp)
                    }

                    if let lastError = viewModel.lastError {
                        Text(lastError)
                            .foregroundStyle(.red)
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
                        viewModel.clearStoredToken()
                    }
                }
            }
            .navigationTitle("OPUS Diagnostics")
        }
    }
}

#Preview {
    DiagnosticsHomeView(
        viewModel: DiagnosticsViewModel(
            runtimeConfigLoader: { .fallbackLocal },
            buildInfoProvider: { BuildInfo.current() },
            tokenStore: KeychainTokenStore(service: "preview", account: "preview"),
            healthService: HealthCheckService(apiClient: PreviewAPIClient())
        )
    )
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
