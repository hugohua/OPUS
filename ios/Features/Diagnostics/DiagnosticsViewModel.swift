import Foundation
import Observation

enum DiagnosticsActionFeedback: Equatable {
    case inProgress(String)
    case success(String)
    case failure(String)

    var message: String {
        switch self {
        case .inProgress(let message), .success(let message), .failure(let message):
            return message
        }
    }
}

@MainActor
@Observable
final class DiagnosticsViewModel {
    var runtimeConfig: RuntimeConfig
    var buildInfo: BuildInfo
    var latestHealthPayload: HealthCheckPayload?
    var isRunningHealthCheck = false
    var lastHealthCheckError: String?
    var actionFeedback: DiagnosticsActionFeedback?

    private let runtimeConfigLoader: () throws -> RuntimeConfig
    private let buildInfoProvider: () -> BuildInfo
    private let tokenStore: AuthTokenStore
    private let healthService: HealthCheckService
    private let clearStoredTokenAction: (@MainActor () async throws -> Void)?

    init(
        runtimeConfigLoader: @escaping () throws -> RuntimeConfig,
        buildInfoProvider: @escaping () -> BuildInfo,
        tokenStore: AuthTokenStore,
        healthService: HealthCheckService,
        clearStoredTokenAction: (@MainActor () async throws -> Void)? = nil
    ) {
        self.runtimeConfigLoader = runtimeConfigLoader
        self.buildInfoProvider = buildInfoProvider
        self.tokenStore = tokenStore
        self.healthService = healthService
        self.clearStoredTokenAction = clearStoredTokenAction
        self.runtimeConfig = (try? runtimeConfigLoader()) ?? .fallbackLocal
        self.buildInfo = buildInfoProvider()
    }

    var tokenStatusText: String {
        let hasToken = (try? tokenStore.fetchToken()) ?? nil
        return hasToken == nil ? "No stored token" : "Stored token available"
    }

    var isPerformingAction: Bool {
        if case .inProgress = actionFeedback {
            return true
        }

        return false
    }

    var healthStatusTitle: String {
        if isRunningHealthCheck {
            return "Checking..."
        }

        if let latestHealthPayload {
            return "Healthy (\(latestHealthPayload.status))"
        }

        return "Not checked yet"
    }

    func runHealthCheck() async {
        isRunningHealthCheck = true
        lastHealthCheckError = nil
        latestHealthPayload = nil
        defer { isRunningHealthCheck = false }

        do {
            latestHealthPayload = try await healthService.checkHealth()
            lastHealthCheckError = nil
        } catch {
            lastHealthCheckError = error.localizedDescription
        }
    }

    func reloadConfig() {
        do {
            runtimeConfig = try runtimeConfigLoader()
            buildInfo = buildInfoProvider()
            clearHealthState()
            actionFeedback = .success("配置已刷新，请重新执行健康检查。")
        } catch {
            actionFeedback = .failure(error.localizedDescription)
        }
    }

    func clearStoredToken() async {
        actionFeedback = .inProgress("正在清除 token 并返回登录态…")
        do {
            if let clearStoredTokenAction {
                try await clearStoredTokenAction()
            } else {
                try tokenStore.clearToken()
            }
            resetTransientState()
        } catch {
            actionFeedback = .failure(error.localizedDescription)
        }
    }

    func resetTransientState() {
        clearHealthState()
        actionFeedback = nil
    }

    private func clearHealthState() {
        latestHealthPayload = nil
        lastHealthCheckError = nil
    }
}
