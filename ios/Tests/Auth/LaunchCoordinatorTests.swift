import XCTest
@testable import OpusApp

@MainActor
final class LaunchCoordinatorTests: XCTestCase {
    func testStartTransitionsToUnauthenticatedWithoutStoredToken() async {
        let coordinator = makeCoordinator(service: LaunchCoordinatorStubService())

        await coordinator.start()

        XCTAssertEqual(coordinator.phase, .unauthenticated)
        XCTAssertNil(coordinator.currentSession)
    }

    func testStartRestoresAuthenticatedSessionWhenStoredTokenIsValid() async {
        let service = LaunchCoordinatorStubService()
        service.hasStoredTokenValue = true
        service.restoreResult = .success(
            MobileAuthSession(
                tokenType: "Bearer",
                accessToken: "token-1",
                expiresAt: "2026-05-01T00:00:00Z",
                user: MobileAuthUser(id: "user-1", name: "Test User", email: "test@opus.dev")
            )
        )
        let coordinator = makeCoordinator(service: service)

        await coordinator.start()

        XCTAssertEqual(coordinator.phase, .authenticated)
        XCTAssertEqual(coordinator.currentSession?.accessToken, "token-1")
    }

    func testStartClearsSessionWhenStoredEnvironmentChanges() async {
        let service = LaunchCoordinatorStubService()
        service.hasStoredTokenValue = true
        let userDefaults = UserDefaults(suiteName: "LaunchCoordinatorTests-\(UUID().uuidString)")!
        let environmentStore = AuthEnvironmentStore(userDefaults: userDefaults)
        environmentStore.saveBaseURL(URL(string: "https://staging.example.com")!)

        let coordinator = LaunchCoordinator(
            runtimeConfigLoader: {
                RuntimeConfig(
                    appEnvironment: .local,
                    apiBaseURL: URL(string: "http://localhost:3000")!,
                    networkLoggingEnabled: true,
                    displayNameSuffix: "Local",
                    allowsInsecureLocalLoads: true
                )
            },
            authSessionService: service,
            authEnvironmentStore: environmentStore
        )

        await coordinator.start()

        XCTAssertEqual(coordinator.phase, .unauthenticated)
        XCTAssertTrue(service.clearSessionCalled)
        XCTAssertFalse(service.restoreSessionCalled)
    }

    func testStartDropsToUnauthenticatedWhenRestoreIsUnauthorized() async {
        let service = LaunchCoordinatorStubService()
        service.hasStoredTokenValue = true
        service.restoreResult = .failure(.unauthorized)
        let coordinator = makeCoordinator(service: service)

        await coordinator.start()

        XCTAssertEqual(coordinator.phase, .unauthenticated)
        XCTAssertNil(coordinator.currentSession)
        XCTAssertNil(coordinator.lastError)
    }

    func testLoginTransitionsToAuthenticated() async throws {
        let service = LaunchCoordinatorStubService()
        service.loginResult = .success(
            MobileAuthSession(
                tokenType: "Bearer",
                accessToken: "token-login",
                expiresAt: "2026-05-01T00:00:00Z",
                user: MobileAuthUser(id: "user-9", name: "Login User", email: "login@opus.dev")
            )
        )
        let coordinator = makeCoordinator(service: service)

        try await coordinator.login(email: "login@opus.dev", password: "secret")

        XCTAssertEqual(coordinator.phase, .authenticated)
        XCTAssertEqual(coordinator.currentSession?.accessToken, "token-login")
    }

    func testLogoutTransitionsToUnauthenticated() async throws {
        let service = LaunchCoordinatorStubService()
        let coordinator = makeCoordinator(service: service)
        coordinator.phase = .authenticated
        coordinator.currentSession = MobileAuthSession(
            tokenType: "Bearer",
            accessToken: "token-login",
            expiresAt: "2026-05-01T00:00:00Z",
            user: MobileAuthUser(id: "user-9", name: "Login User", email: "login@opus.dev")
        )

        try await coordinator.logout()

        XCTAssertEqual(coordinator.phase, .unauthenticated)
        XCTAssertNil(coordinator.currentSession)
        XCTAssertTrue(service.logoutCalled)
    }

    private func makeCoordinator(service: LaunchCoordinatorStubService) -> LaunchCoordinator {
        let userDefaults = UserDefaults(suiteName: "LaunchCoordinatorTests-\(UUID().uuidString)")!
        let environmentStore = AuthEnvironmentStore(userDefaults: userDefaults)

        return LaunchCoordinator(
            runtimeConfigLoader: {
                RuntimeConfig(
                    appEnvironment: .local,
                    apiBaseURL: URL(string: "http://localhost:3000")!,
                    networkLoggingEnabled: true,
                    displayNameSuffix: "Local",
                    allowsInsecureLocalLoads: true
                )
            },
            authSessionService: service,
            authEnvironmentStore: environmentStore
        )
    }
}

private final class LaunchCoordinatorStubService: AuthSessionManaging {
    var hasStoredTokenValue = false
    var restoreResult: Result<MobileAuthSession, AuthSessionError>?
    var loginResult: Result<MobileAuthSession, AuthSessionError>?
    var clearSessionCalled = false
    var restoreSessionCalled = false
    var logoutCalled = false

    func hasStoredToken() -> Bool {
        hasStoredTokenValue
    }

    func login(_ request: MobileLoginRequest) async throws -> MobileAuthSession {
        guard let loginResult else {
            fatalError("Missing login result")
        }

        switch loginResult {
        case .success(let session):
            return session
        case .failure(let error):
            throw error
        }
    }

    func register(_ request: MobileRegisterRequest) async throws -> MobileAuthSession {
        fatalError("Unused in LaunchCoordinator tests")
    }

    func restoreSession() async throws -> MobileAuthSession {
        restoreSessionCalled = true
        guard let restoreResult else {
            fatalError("Missing restore result")
        }

        switch restoreResult {
        case .success(let session):
            return session
        case .failure(let error):
            throw error
        }
    }

    func refreshSession() async throws -> MobileAuthSession {
        fatalError("Unused in LaunchCoordinator tests")
    }

    func logout() async throws {
        logoutCalled = true
    }

    func clearSession() throws {
        clearSessionCalled = true
    }
}
