import Foundation

protocol AuthSessionManaging {
    func hasStoredToken() -> Bool
    func login(_ request: MobileLoginRequest) async throws -> MobileAuthSession
    func register(_ request: MobileRegisterRequest) async throws -> MobileAuthSession
    func restoreSession() async throws -> MobileAuthSession
    func refreshSession() async throws -> MobileAuthSession
    func logout() async throws
    func clearSession() throws
}

struct AuthSessionService: AuthSessionManaging {
    private let apiClient: APIClient
    private let tokenStore: AuthTokenStore
    private let environmentStore: AuthEnvironmentStore
    private let currentBaseURL: () -> URL
    private let decoder = JSONDecoder()

    init(
        apiClient: APIClient,
        tokenStore: AuthTokenStore,
        environmentStore: AuthEnvironmentStore,
        currentBaseURL: @escaping () -> URL
    ) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
        self.environmentStore = environmentStore
        self.currentBaseURL = currentBaseURL
    }

    func hasStoredToken() -> Bool {
        ((try? tokenStore.fetchToken()) ?? nil) != nil
    }

    func login(_ request: MobileLoginRequest) async throws -> MobileAuthSession {
        let endpoint = try makeLoginEndpoint(for: request)
        let response: MobileAuthSessionEnvelope
        do {
            response = try await apiClient.send(endpoint, as: MobileAuthSessionEnvelope.self)
        } catch {
            throw try mapSessionError(error, clearSessionOnUnauthorized: false)
        }

        return try persistSession(response.data)
    }

    func register(_ request: MobileRegisterRequest) async throws -> MobileAuthSession {
        let endpoint = try makeRegisterEndpoint(for: request)
        let response: MobileAuthSessionEnvelope
        do {
            response = try await apiClient.send(endpoint, as: MobileAuthSessionEnvelope.self)
        } catch {
            throw try mapSessionError(error, clearSessionOnUnauthorized: false)
        }

        return try persistSession(response.data)
    }

    func restoreSession() async throws -> MobileAuthSession {
        do {
            let response: MobileAuthSessionEnvelope = try await apiClient.send(
                MobileAuthMeEndpoint(),
                as: MobileAuthSessionEnvelope.self
            )
            return try persistSession(response.data)
        } catch {
            throw try mapSessionError(error, clearSessionOnUnauthorized: true)
        }
    }

    func refreshSession() async throws -> MobileAuthSession {
        do {
            let response: MobileAuthSessionEnvelope = try await apiClient.send(
                MobileAuthRefreshEndpoint(),
                as: MobileAuthSessionEnvelope.self
            )
            return try persistSession(response.data)
        } catch {
            throw try mapSessionError(error, clearSessionOnUnauthorized: true)
        }
    }

    func logout() async throws {
        do {
            _ = try await apiClient.send(MobileAuthLogoutEndpoint(), as: MobileLogoutEnvelope.self)
        } catch {
            // Logout is client-driven in wave-0. Best-effort server notification only.
        }

        try clearSession()
    }

    func clearSession() throws {
        do {
            try tokenStore.clearToken()
        } catch {
            throw AuthSessionError.storage(error.localizedDescription)
        }

        environmentStore.clearBaseURL()
    }

    private func makeLoginEndpoint(for request: MobileLoginRequest) throws -> MobileAuthLoginEndpoint {
        do {
            return try MobileAuthLoginEndpoint(request: request)
        } catch {
            throw AuthSessionError.server("登录请求构建失败。")
        }
    }

    private func makeRegisterEndpoint(for request: MobileRegisterRequest) throws -> MobileAuthRegisterEndpoint {
        do {
            return try MobileAuthRegisterEndpoint(request: request)
        } catch {
            throw AuthSessionError.server("注册请求构建失败。")
        }
    }

    private func persistSession(_ session: MobileAuthSession) throws -> MobileAuthSession {
        do {
            try tokenStore.saveToken(session.accessToken)
            environmentStore.saveBaseURL(currentBaseURL())
            return session
        } catch {
            try? tokenStore.clearToken()
            environmentStore.clearBaseURL()
            throw AuthSessionError.storage(error.localizedDescription)
        }
    }

    private func decodeMobileError(from data: Data?) -> MobileAuthError? {
        guard let data else {
            return nil
        }

        return try? decoder.decode(MobileAuthError.self, from: data)
    }

    private func mapSessionError(
        _ error: Error,
        clearSessionOnUnauthorized: Bool
    ) throws -> AuthSessionError {
        guard let networkError = error as? NetworkError else {
            return .server("认证请求失败。")
        }

        switch networkError {
        case .httpStatus(let code, let data):
            let decodedError = decodeMobileError(from: data)
            let mapped = mapHTTPError(code: code, decodedError: decodedError)

            if clearSessionOnUnauthorized, mapped.shouldInvalidateStoredSession {
                try? clearSession()
            }

            return mapped
        case .transport(let description):
            return .network(description)
        case .decoding:
            return .server("服务端响应无法解析。")
        case .invalidURL, .invalidResponse:
            return .server(networkError.localizedDescription)
        }
    }

    private func mapHTTPError(code: Int, decodedError: MobileAuthError?) -> AuthSessionError {
        if code == 401 {
            return .unauthorized
        }

        guard let decodedError else {
            return .server("服务端请求失败（\(code)）。")
        }

        switch decodedError.code {
        case "VALIDATION_ERROR":
            return .validation(
                message: decodedError.message,
                fieldErrors: decodedError.fieldErrors ?? [:]
            )
        case "INVALID_CREDENTIALS":
            return .invalidCredentials
        case "INVALID_INVITE_CODE":
            return .invalidInviteCode
        case "EMAIL_ALREADY_REGISTERED":
            return .emailAlreadyRegistered
        case "UNAUTHORIZED":
            return .unauthorized
        default:
            return .server(decodedError.message)
        }
    }
}
