import Foundation

struct MobileEnvelope<T: Decodable>: Decodable {
    let status: String
    let data: T
}
