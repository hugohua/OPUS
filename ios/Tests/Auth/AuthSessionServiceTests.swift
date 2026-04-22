import XCTest
@testable import OpusApp

final class AuthSessionServiceTests: XCTestCase {
    func testLoginPersistsTokenAndEnvironmentOnSuccess() async throws {
        let apiClient = StubAPIClient()
        let tokenStore = MemoryTokenStore()
        let userDefaults = UserDefaults(suiteName: "AuthSessionServiceTests-\(UUID().uuidString)")!
        let environmentStore = AuthEnvironmentStore(userDefaults: userDefaults)
        let baseURL = URL(string: "http://localhost:3000")!

        apiClient.handler = { endpoint, _ in
            XCTAssertEqual(endpoint.path, "/api/mobile/v1/auth/login")
            XCTAssertFalse(endpoint.requiresAuthorization)

            return MobileAuthSessionEnvelope(
                status: "success",
                data: MobileAuthSession(
                    tokenType: "Bearer",
                    accessToken: "token-1",
                    expiresAt: "2026-05-01T00:00:00Z",
                    user: MobileAuthUser(id: "user-1", name: "Test User", email: "test@opus.dev")
                )
            )
        }

        let service = AuthSessionService(
            apiClient: apiClient,
            tokenStore: tokenStore,
            environmentStore: environmentStore,
            currentBaseURL: { baseURL }
        )

        let session = try await service.login(
            MobileLoginRequest(email: "test@opus.dev", password: "secret")
        )

        XCTAssertEqual(session.accessToken, "token-1")
        XCTAssertEqual(tokenStore.token, "token-1")
        XCTAssertEqual(environmentStore.fetchBaseURL(), baseURL)
    }

    func testLoginMapsValidationErrorsFromServer() async {
        let apiClient = StubAPIClient()
        let tokenStore = MemoryTokenStore()
        let environmentStore = AuthEnvironmentStore(
            userDefaults: UserDefaults(suiteName: "AuthSessionServiceTests-\(UUID().uuidString)")!
        )

        apiClient.handler = { _, _ in
            throw NetworkError.httpStatus(
                400,
                """
                {"status":"error","code":"VALIDATION_ERROR","message":"Validation failed","fieldErrors":{"email":"请输入有效的邮箱地址"}}
                """.data(using: .utf8)
            )
        }

        let service = AuthSessionService(
            apiClient: apiClient,
            tokenStore: tokenStore,
            environmentStore: environmentStore,
            currentBaseURL: { URL(string: "http://localhost:3000")! }
        )

        do {
            _ = try await service.login(MobileLoginRequest(email: "bad", password: "secret"))
            XCTFail("Expected validation failure")
        } catch let error as AuthSessionError {
            XCTAssertEqual(
                error,
                .validation(message: "Validation failed", fieldErrors: ["email": "请输入有效的邮箱地址"])
            )
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testRegisterDoesNotTransitionWhenTokenSaveFails() async {
        let apiClient = StubAPIClient()
        let tokenStore = MemoryTokenStore()
        tokenStore.saveError = KeychainError.unhandledStatus(-1)
        let userDefaults = UserDefaults(suiteName: "AuthSessionServiceTests-\(UUID().uuidString)")!
        let environmentStore = AuthEnvironmentStore(userDefaults: userDefaults)

        apiClient.handler = { _, _ in
            MobileAuthSessionEnvelope(
                status: "success",
                data: MobileAuthSession(
                    tokenType: "Bearer",
                    accessToken: "token-2",
                    expiresAt: "2026-05-01T00:00:00Z",
                    user: MobileAuthUser(id: "user-2", name: "New User", email: "new@opus.dev")
                )
            )
        }

        let service = AuthSessionService(
            apiClient: apiClient,
            tokenStore: tokenStore,
            environmentStore: environmentStore,
            currentBaseURL: { URL(string: "http://localhost:3000")! }
        )

        do {
            _ = try await service.register(
                MobileRegisterRequest(
                    email: "new@opus.dev",
                    password: "secret",
                    name: "New User",
                    inviteCode: "INVITE"
                )
            )
            XCTFail("Expected storage failure")
        } catch let error as AuthSessionError {
            guard case .storage = error else {
                XCTFail("Expected storage error, got \(error)")
                return
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        XCTAssertNil(tokenStore.token)
        XCTAssertNil(environmentStore.fetchBaseURL())
    }

    func testRestoreClearsLocalSessionOnUnauthorized() async {
        let apiClient = StubAPIClient()
        let tokenStore = MemoryTokenStore(token: "stale-token")
        let userDefaults = UserDefaults(suiteName: "AuthSessionServiceTests-\(UUID().uuidString)")!
        let environmentStore = AuthEnvironmentStore(userDefaults: userDefaults)
        environmentStore.saveBaseURL(URL(string: "http://localhost:3000")!)

        apiClient.handler = { _, _ in
            throw NetworkError.httpStatus(
                401,
                """
                {"status":"error","code":"UNAUTHORIZED","message":"Unauthorized"}
                """.data(using: .utf8)
            )
        }

        let service = AuthSessionService(
            apiClient: apiClient,
            tokenStore: tokenStore,
            environmentStore: environmentStore,
            currentBaseURL: { URL(string: "http://localhost:3000")! }
        )

        do {
            _ = try await service.restoreSession()
            XCTFail("Expected unauthorized error")
        } catch let error as AuthSessionError {
            XCTAssertEqual(error, .unauthorized)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        XCTAssertNil(tokenStore.token)
        XCTAssertNil(environmentStore.fetchBaseURL())
    }
}

private final class StubAPIClient: APIClient {
    var handler: ((Endpoint, Any.Type) async throws -> Any)?

    func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        guard let handler else {
            fatalError("Missing StubAPIClient handler")
        }

        let value = try await handler(endpoint, type)
        guard let typedValue = value as? T else {
            fatalError("Unexpected stub value type: \(value)")
        }

        return typedValue
    }
}

private final class MemoryTokenStore: AuthTokenStore {
    var token: String?
    var saveError: Error?
    var clearError: Error?

    init(token: String? = nil) {
        self.token = token
    }

    func fetchToken() throws -> String? {
        token
    }

    func saveToken(_ token: String) throws {
        if let saveError {
            throw saveError
        }

        self.token = token
    }

    func clearToken() throws {
        if let clearError {
            throw clearError
        }

        token = nil
    }
}
