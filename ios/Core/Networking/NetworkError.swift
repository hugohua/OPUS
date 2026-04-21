import Foundation

enum NetworkError: LocalizedError, Equatable {
    case invalidURL(String)
    case invalidResponse
    case httpStatus(Int, Data?)
    case transport(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL(let value):
            return "Invalid URL: \(value)"
        case .invalidResponse:
            return "Received an invalid response."
        case .httpStatus(let code, _):
            return "Request failed with status code \(code)."
        case .transport(let description):
            return "Transport error: \(description)"
        case .decoding(let description):
            return "Decoding error: \(description)"
        }
    }

    static func == (lhs: NetworkError, rhs: NetworkError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidURL(let l), .invalidURL(let r)):
            return l == r
        case (.invalidResponse, .invalidResponse):
            return true
        case (.httpStatus(let lCode, _), .httpStatus(let rCode, _)):
            return lCode == rCode
        case (.transport(let l), .transport(let r)):
            return l == r
        case (.decoding(let l), .decoding(let r)):
            return l == r
        default:
            return false
        }
    }
}
