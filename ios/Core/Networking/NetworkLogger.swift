import Foundation

struct NetworkLogger {
    let enabled: Bool

    func log(request: URLRequest) {
        guard enabled else { return }
        print("[Network] \(request.httpMethod ?? "UNKNOWN") \(request.url?.absoluteString ?? "nil")")
    }

    func log(response: HTTPURLResponse, data: Data) {
        guard enabled else { return }
        print("[Network] Response \(response.statusCode) (\(data.count) bytes)")
    }

    func log(error: Error) {
        guard enabled else { return }
        print("[Network] Error \(error.localizedDescription)")
    }
}
