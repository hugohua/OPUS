import Foundation
import XCTest
@testable import OpusApp

final class URLSessionAPIClientTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.requestHandler = nil
    }

    func testDecodesSuccessPayload() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer stub-token")
            let data = """
            {"status":"ok","timestamp":"2026-04-19T00:00:00Z","env":"local","version":"1.0.0"}
            """.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, data)
        }

        let client = URLSessionAPIClient(
            session: makeSession(),
            requestBuilder: RequestBuilder(baseURL: URL(string: "http://localhost:3000")!),
            tokenStore: StubTokenStore(token: "stub-token"),
            logger: NetworkLogger(enabled: false)
        )

        let payload = try await client.send(HealthCheckEndpoint(), as: HealthCheckPayload.self)

        XCTAssertEqual(payload.env, "local")
        XCTAssertEqual(payload.version, "1.0.0")
    }

    func testThrowsForHTTPFailure() async {
        URLProtocolStub.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 503,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data("offline".utf8))
        }

        let client = URLSessionAPIClient(
            session: makeSession(),
            requestBuilder: RequestBuilder(baseURL: URL(string: "http://localhost:3000")!),
            tokenStore: StubTokenStore(token: nil),
            logger: NetworkLogger(enabled: false)
        )

        await XCTAssertThrowsErrorAsync(
            try await client.send(HealthCheckEndpoint(), as: HealthCheckPayload.self)
        ) { error in
            XCTAssertEqual(error as? NetworkError, .httpStatus(503, nil))
        }
    }

    func testThrowsForInvalidResponseBody() async {
        URLProtocolStub.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data("not-json".utf8))
        }

        let client = URLSessionAPIClient(
            session: makeSession(),
            requestBuilder: RequestBuilder(baseURL: URL(string: "http://localhost:3000")!),
            tokenStore: StubTokenStore(token: nil),
            logger: NetworkLogger(enabled: false)
        )

        await XCTAssertThrowsErrorAsync(
            try await client.send(HealthCheckEndpoint(), as: HealthCheckPayload.self)
        ) { error in
            guard case .decoding = error as? NetworkError else {
                XCTFail("Expected decoding error, got \(error)")
                return
            }
        }
    }

    func testPreservesUnauthorizedResponseBody() async {
        URLProtocolStub.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 401,
                httpVersion: nil,
                headerFields: nil
            )!
            let data = """
            {"status":"error","code":"UNAUTHORIZED","message":"Unauthorized"}
            """.data(using: .utf8)!
            return (response, data)
        }

        let client = URLSessionAPIClient(
            session: makeSession(),
            requestBuilder: RequestBuilder(baseURL: URL(string: "http://localhost:3000")!),
            tokenStore: StubTokenStore(token: "stale-token"),
            logger: NetworkLogger(enabled: false)
        )

        await XCTAssertThrowsErrorAsync(
            try await client.send(HealthCheckEndpoint(), as: HealthCheckPayload.self)
        ) { error in
            guard case .httpStatus(let code, let data) = error as? NetworkError else {
                XCTFail("Expected httpStatus error, got \(error)")
                return
            }

            XCTAssertEqual(code, 401)
            XCTAssertEqual(String(data: data ?? Data(), encoding: .utf8), #"{"status":"error","code":"UNAUTHORIZED","message":"Unauthorized"}"#)
        }
    }

    private func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        return URLSession(configuration: configuration)
    }
}

private final class URLProtocolStub: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            XCTFail("Missing request handler")
            return
        }

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

private struct StubTokenStore: AuthTokenStore {
    let token: String?

    func fetchToken() throws -> String? { token }
    func saveToken(_ token: String) throws {}
    func clearToken() throws {}
}

func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ verify: (Error) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("Expected expression to throw", file: file, line: line)
    } catch {
        verify(error)
    }
}
