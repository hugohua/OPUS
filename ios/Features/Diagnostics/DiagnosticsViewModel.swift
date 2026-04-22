import Foundation
import Observation

@MainActor
@Observable
final class DiagnosticsViewModel {
    var runtimeConfig: RuntimeConfig
    var buildInfo: BuildInfo
    var latestHealthPayload: HealthCheckPayload?
    var isRunningHealthCheck = false
    var lastHealthCheckError: String?
    var lastActionError: String?

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
            lastActionError = nil
        } catch {
            lastActionError = error.localizedDescription
        }
    }

    func clearStoredToken() {
        if let clearStoredTokenAction {
            Task {
                do {
                    try await clearStoredTokenAction()
                    lastActionError = nil
                } catch {
                    lastActionError = error.localizedDescription
                }
            }
            return
        }

        do {
            try tokenStore.clearToken()
            lastActionError = nil
        } catch {
            lastActionError = error.localizedDescription
        }
    }
}
