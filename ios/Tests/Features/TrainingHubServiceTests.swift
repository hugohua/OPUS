import XCTest
@testable import OpusApp

final class TrainingHubServiceTests: XCTestCase {
    func testFetchTrainingSectionsDecodesSharedMatrixEnvelope() async throws {
        let apiClient = TrainingMatrixStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "sections": [
              {
                "id": "arena",
                "title": "实战演练舱",
                "subtitle": "Part 5/6/7",
                "label": "ARC",
                "theme": "rose",
                "entries": [
                  {
                    "id": "arena-blitz",
                    "title": "单句闪电战",
                    "subtitle": "碎片极速快测",
                    "detail": "Part 5",
                    "tag": "Part 5",
                    "systemImage": "bolt",
                    "accent": "violet",
                    "destination": { "kind": "arena", "value": "part5" },
                    "availability": "ready",
                    "count": 3,
                    "statusLabel": "可练: 3"
                  },
                  {
                    "id": "l3-history",
                    "title": "阅读历史",
                    "subtitle": "回顾已生成的简报",
                    "detail": "L3-HISTORY",
                    "tag": "L3-HISTORY",
                    "systemImage": "clock.arrow.circlepath",
                    "accent": "emerald",
                    "destination": { "kind": "briefing", "value": "history" }
                  }
                ]
              }
            ]
          }
        }
        """)
        let service = TrainingHubService(apiClient: apiClient)

        let sections = try await service.fetchTrainingSections()

        XCTAssertEqual(apiClient.lastEndpointPath, "/api/mobile/v1/training/matrix")
        XCTAssertEqual(sections.map(\.id), ["arena"])
        XCTAssertEqual(sections.first?.entries.map(\.id), ["arena-blitz", "l3-history"])
        XCTAssertEqual(sections.first?.entries.first?.destination, .arena(path: "part5"))
        XCTAssertEqual(sections.first?.entries.last?.destination, .briefingHistory)
        XCTAssertEqual(sections.first?.entries.first?.availability, .available(label: "可练: 3"))
    }
}

private final class TrainingMatrixStubAPIClient: APIClient {
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
