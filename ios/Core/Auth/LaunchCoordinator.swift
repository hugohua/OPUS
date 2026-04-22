import Foundation
import Observation

@MainActor
@Observable
final class LaunchCoordinator {
    enum Phase: Equatable {
        case launching
        case restoring
        case unauthenticated
        case authenticated
    }

    private let runtimeConfigLoader: () throws -> RuntimeConfig
    private let authSessionService: AuthSessionManaging
    private let authEnvironmentStore: AuthEnvironmentStore

    var phase: Phase = .launching
    var currentSession: MobileAuthSession?
    var lastError: AuthSessionError?

    init(
        runtimeConfigLoader: @escaping () throws -> RuntimeConfig,
        authSessionService: AuthSessionManaging,
        authEnvironmentStore: AuthEnvironmentStore
    ) {
        self.runtimeConfigLoader = runtimeConfigLoader
        self.authSessionService = authSessionService
        self.authEnvironmentStore = authEnvironmentStore
    }

    func start() async {
        guard phase == .launching else {
            return
        }

        let runtimeConfig: RuntimeConfig
        do {
            runtimeConfig = try runtimeConfigLoader()
        } catch {
            lastError = .server(error.localizedDescription)
            currentSession = nil
            phase = .unauthenticated
            return
        }

        if let storedBaseURL = authEnvironmentStore.fetchBaseURL(), storedBaseURL != runtimeConfig.apiBaseURL {
            try? authSessionService.clearSession()
            lastError = nil
            currentSession = nil
            phase = .unauthenticated
            return
        }

        guard authSessionService.hasStoredToken() else {
            lastError = nil
            currentSession = nil
            phase = .unauthenticated
            return
        }

        phase = .restoring

        do {
            let session = try await authSessionService.restoreSession()
            currentSession = session
            lastError = nil
            phase = .authenticated
        } catch let authError as AuthSessionError {
            currentSession = nil
            lastError = authError.shouldInvalidateStoredSession ? nil : authError
            phase = .unauthenticated
        } catch {
            currentSession = nil
            lastError = .server(error.localizedDescription)
            phase = .unauthenticated
        }
    }

    func retryRestore() async {
        phase = .launching
        await start()
    }

    func login(email: String, password: String) async throws {
        let session = try await authSessionService.login(
            MobileLoginRequest(email: email, password: password)
        )
        currentSession = session
        lastError = nil
        phase = .authenticated
    }

    func register(
        email: String,
        password: String,
        name: String,
        inviteCode: String
    ) async throws {
        let session = try await authSessionService.register(
            MobileRegisterRequest(
                email: email,
                password: password,
                name: name,
                inviteCode: inviteCode
            )
        )
        currentSession = session
        lastError = nil
        phase = .authenticated
    }

    func logout() async throws {
        try await authSessionService.logout()
        currentSession = nil
        lastError = nil
        phase = .unauthenticated
    }
}
