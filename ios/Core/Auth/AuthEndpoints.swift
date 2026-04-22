import Foundation

private let authRequestEncoder = JSONEncoder()

private func encodeAuthBody<T: Encodable>(_ value: T) throws -> Data {
    try authRequestEncoder.encode(value)
}

struct MobileAuthLoginEndpoint: Endpoint {
    let path = "/api/mobile/v1/auth/login"
    let method: HTTPMethod = .post
    let body: Data?
    let requiresAuthorization = false

    init(request: MobileLoginRequest) throws {
        body = try encodeAuthBody(request)
    }
}

struct MobileAuthRegisterEndpoint: Endpoint {
    let path = "/api/mobile/v1/auth/register"
    let method: HTTPMethod = .post
    let body: Data?
    let requiresAuthorization = false

    init(request: MobileRegisterRequest) throws {
        body = try encodeAuthBody(request)
    }
}

struct MobileAuthMeEndpoint: Endpoint {
    let path = "/api/mobile/v1/auth/me"
    let method: HTTPMethod = .get
}

struct MobileAuthRefreshEndpoint: Endpoint {
    let path = "/api/mobile/v1/auth/refresh"
    let method: HTTPMethod = .post
}

struct MobileAuthLogoutEndpoint: Endpoint {
    let path = "/api/mobile/v1/auth/logout"
    let method: HTTPMethod = .post
}
