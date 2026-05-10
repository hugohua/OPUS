import XCTest
@testable import OpusApp

final class LearningDiagnosticRadarServiceTests: XCTestCase {
    func testFetchRadarDecodesMobileEnvelope() async throws {
        let apiClient = LearningDiagnosticRadarStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "radarData": [
              { "subject": "基础语法", "A": 42, "fullMark": 100 }
            ],
            "weakest": {
              "questionType": "GRAMMAR",
              "label": "基础语法",
              "total": 7,
              "correct": 3,
              "accuracy": 42,
              "avgResponseMs": 3200
            },
            "totalAttempts": 7
          }
        }
        """)
        let service = LearningDiagnosticRadarService(apiClient: apiClient)

        let payload = try await service.fetchRadar()

        XCTAssertEqual(apiClient.lastEndpointPath, "/api/mobile/v1/diagnostics/radar")
        XCTAssertEqual(payload.radarData.first?.subject, "基础语法")
        XCTAssertEqual(payload.radarData.first?.score, 42)
        XCTAssertEqual(payload.weakest?.questionType, "GRAMMAR")
        XCTAssertEqual(payload.totalAttempts, 7)
    }
}

private final class LearningDiagnosticRadarStubAPIClient: APIClient {
    let jsonResponse: String
    private(set) var lastEndpointPath: String?

    init(jsonResponse: String) {
        self.jsonResponse = jsonResponse
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T: Decodable {
        lastEndpointPath = endpoint.path
        return try JSONDecoder().decode(T.self, from: Data(jsonResponse.utf8))
    }
}
