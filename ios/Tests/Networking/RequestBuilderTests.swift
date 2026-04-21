import Foundation
import XCTest
@testable import OpusApp

final class RequestBuilderTests: XCTestCase {
    func testBuildsRequestWithBearerTokenAndQueryItems() throws {
        let request = try RequestBuilder(baseURL: URL(string: "http://localhost:3000")!)
            .makeRequest(
                for: TestEndpoint(
                    path: "/api/mobile/v1/health",
                    queryItems: [URLQueryItem(name: "verbose", value: "1")]
                ),
                token: "abc123"
            )

        XCTAssertEqual(
            request.url?.absoluteString,
            "http://localhost:3000/api/mobile/v1/health?verbose=1"
        )
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer abc123")
    }

    func testBuildsRequestWithoutAuthorizationHeaderWhenTokenMissing() throws {
        let request = try RequestBuilder(baseURL: URL(string: "http://localhost:3000")!)
            .makeRequest(for: TestEndpoint(path: "api/mobile/v1/health"), token: nil)

        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }
}

private struct TestEndpoint: Endpoint {
    let path: String
    var method: HTTPMethod = .get
    var queryItems: [URLQueryItem] = []
}
