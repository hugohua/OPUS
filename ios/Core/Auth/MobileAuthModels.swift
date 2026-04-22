import Foundation

struct MobileAuthUser: Codable, Equatable {
    let id: String
    let name: String?
    let email: String
}

struct MobileAuthSession: Codable, Equatable {
    let tokenType: String
    let accessToken: String
    let expiresAt: String
    let user: MobileAuthUser
}

struct MobileAuthError: Codable, Equatable {
    let status: String
    let code: String
    let message: String
    let fieldErrors: [String: String]?
}

struct MobileLoginRequest: Encodable, Equatable {
    let email: String
    let password: String
}

struct MobileRegisterRequest: Encodable, Equatable {
    let email: String
    let password: String
    let name: String
    let inviteCode: String
}

struct MobileAuthSessionEnvelope: Decodable, Equatable {
    let status: String
    let data: MobileAuthSession
}

struct MobileLogoutEnvelope: Decodable, Equatable {
    let status: String
}
