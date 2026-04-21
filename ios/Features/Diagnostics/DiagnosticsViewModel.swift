import Foundation
import Observation

@MainActor
@Observable
final class DiagnosticsViewModel {
    var runtimeConfig: RuntimeConfig
    var buildInfo: BuildInfo
    var latestHealthPayload: HealthCheckPayload?
    var isRunningHealthCheck = false
    var lastError: String?

    private let runtimeConfigLoader: () throws -> RuntimeConfig
    private let buildInfoProvider: () -> BuildInfo
    private let tokenStore: AuthTokenStore
    private let healthService: HealthCheckService

    init(
        runtimeConfigLoader: @escaping () throws -> RuntimeConfig,
        buildInfoProvider: @escaping () -> BuildInfo,
        tokenStore: AuthTokenStore,
        healthService: HealthCheckService
    ) {
        self.runtimeConfigLoader = runtimeConfigLoader
        self.buildInfoProvider = buildInfoProvider
        self.tokenStore = tokenStore
        self.healthService = healthService
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
        defer { isRunningHealthCheck = false }

        do {
            latestHealthPayload = try await healthService.checkHealth()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func reloadConfig() {
        do {
            runtimeConfig = try runtimeConfigLoader()
            buildInfo = buildInfoProvider()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func clearStoredToken() {
        do {
            try tokenStore.clearToken()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }
}
