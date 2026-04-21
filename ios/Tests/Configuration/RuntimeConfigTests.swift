import XCTest
@testable import OpusApp

final class RuntimeConfigTests: XCTestCase {
    func testParsesRuntimeConfigFromInfoDictionary() throws {
        let config = try RuntimeConfig(
            infoDictionary: [
                RuntimeConfig.environmentKey: "staging",
                RuntimeConfig.baseURLKey: "https://staging.example.com",
                RuntimeConfig.networkLoggingKey: "YES",
                RuntimeConfig.displayNameSuffixKey: "Staging",
                RuntimeConfig.allowInsecureLocalLoadsKey: "NO",
            ]
        )

        XCTAssertEqual(config.appEnvironment, .staging)
        XCTAssertEqual(config.apiBaseURL.absoluteString, "https://staging.example.com")
        XCTAssertEqual(config.networkLoggingEnabled, true)
        XCTAssertEqual(config.displayNameSuffix, "Staging")
        XCTAssertEqual(config.allowsInsecureLocalLoads, false)
    }

    func testThrowsForInvalidBaseURL() {
        XCTAssertThrowsError(
            try RuntimeConfig(
                infoDictionary: [
                    RuntimeConfig.environmentKey: "local",
                    RuntimeConfig.baseURLKey: "not a url",
                    RuntimeConfig.networkLoggingKey: "YES",
                    RuntimeConfig.displayNameSuffixKey: "Local",
                    RuntimeConfig.allowInsecureLocalLoadsKey: "YES",
                ]
            )
        )
    }
}
