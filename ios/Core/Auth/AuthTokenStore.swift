import Foundation

protocol AuthTokenStore {
    func fetchToken() throws -> String?
    func saveToken(_ token: String) throws
    func clearToken() throws
}
