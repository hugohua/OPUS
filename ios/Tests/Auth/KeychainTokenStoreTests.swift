import XCTest
@testable import OpusApp

final class KeychainTokenStoreTests: XCTestCase {
    func testSavesFetchesAndClearsToken() throws {
        let store = KeychainTokenStore(
            service: "com.hugo.opus.tests.\(UUID().uuidString)",
            account: "bearer"
        )

        try store.clearToken()
        XCTAssertNil(try store.fetchToken())

        try store.saveToken("hello-token")
        XCTAssertEqual(try store.fetchToken(), "hello-token")

        try store.clearToken()
        XCTAssertNil(try store.fetchToken())
    }
}
