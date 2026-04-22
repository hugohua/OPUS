import Foundation

enum AuthSessionError: LocalizedError, Equatable {
    case validation(message: String, fieldErrors: [String: String])
    case invalidCredentials
    case invalidInviteCode
    case emailAlreadyRegistered
    case unauthorized
    case network(String)
    case server(String)
    case storage(String)

    var shouldInvalidateStoredSession: Bool {
        if case .unauthorized = self {
            return true
        }

        return false
    }

    var fieldErrors: [String: String] {
        if case .validation(_, let fieldErrors) = self {
            return fieldErrors
        }

        return [:]
    }

    var errorDescription: String? {
        switch self {
        case .validation(let message, _):
            return message
        case .invalidCredentials:
            return "邮箱或密码错误。"
        case .invalidInviteCode:
            return "邀请码无效或已过期。"
        case .emailAlreadyRegistered:
            return "该邮箱已被注册。"
        case .unauthorized:
            return "登录状态已失效。"
        case .network(let description):
            return "网络请求失败：\(description)"
        case .server(let description):
            return description
        case .storage(let description):
            return "本地会话存储失败：\(description)"
        }
    }
}
