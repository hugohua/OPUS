import Foundation
import XCTest
@testable import OpusApp

final class SSEClientTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SSEURLProtocolStub.requestHandler = nil
    }

    func testStreamsContentAndDoneEvents() async throws {
        SSEURLProtocolStub.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            let data = """
            data: {"type":"content","data":"hello"}

            data: {"type":"done"}

            """.data(using: .utf8)!
            return (response, data)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SSEURLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = SSEClient(
            session: session,
            requestBuilder: RequestBuilder(baseURL: URL(string: "http://localhost:3000")!),
            tokenStore: StubSSETokenStore(token: "token")
        )

        var events: [SSEClientEvent] = []
        for try await event in try client.stream(StubSSEEndpoint()) {
            events.append(event)
        }

        XCTAssertEqual(events, [.content("hello"), .done])
    }
}

private struct StubSSEEndpoint: Endpoint {
    let path = "/api/mobile/v1/weaver/generate"
    let method: HTTPMethod = .post
}

private struct StubSSETokenStore: AuthTokenStore {
    let token: String?
    func fetchToken() throws -> String? { token }
    func saveToken(_ token: String) throws {}
    func clearToken() throws {}
}

private final class SSEURLProtocolStub: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else { return }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
