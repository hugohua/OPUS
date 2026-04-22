import Foundation

enum SSEClientEvent: Equatable {
    case content(String)
    case done
    case error(String)
}

struct SSEClient {
    let session: URLSession
    let requestBuilder: RequestBuilder
    let tokenStore: AuthTokenStore

    init(
        session: URLSession = .shared,
        requestBuilder: RequestBuilder,
        tokenStore: AuthTokenStore
    ) {
        self.session = session
        self.requestBuilder = requestBuilder
        self.tokenStore = tokenStore
    }

    func stream(_ endpoint: Endpoint) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        let token = try tokenStore.fetchToken()
        let request = try requestBuilder.makeRequest(for: endpoint, token: token)

        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await session.bytes(for: request)
                    guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
                        throw NetworkError.invalidResponse
                    }

                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let payload = String(line.dropFirst(6))
                        if let event = parse(payload) {
                            continuation.yield(event)
                            if event == .done {
                                continuation.finish()
                            }
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    private func parse(_ payload: String) -> SSEClientEvent? {
        guard let data = payload.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(SSEPayload.self, from: data) else {
            return nil
        }

        switch decoded.type {
        case "content":
            return .content(decoded.data ?? "")
        case "done":
            return .done
        case "error":
            return .error(decoded.error ?? "Unknown SSE error")
        default:
            return nil
        }
    }
}

private struct SSEPayload: Decodable {
    let type: String
    let data: String?
    let error: String?
}
