import XCTest
@testable import OpusApp

final class SessionRunnerServiceTests: XCTestCase {
    func testMarksStringOptionsUsingAnswerKey() async throws {
        let apiClient = DecodingStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "count": 1,
            "items": [
              {
                "meta": {
                  "mode": "SYNTAX",
                  "vocabId": 7,
                  "target_word": "audit"
                },
                "segments": [
                  {
                    "type": "interaction",
                    "task": {
                      "question_markdown": "Choose the best answer.",
                      "options": ["approve", "audit"],
                      "answer_key": "audit"
                    }
                  }
                ]
              }
            ]
          }
        }
        """)
        let service = SessionRunnerService(apiClient: apiClient)

        let session = try await service.fetchSession(for: .training(mode: "SYNTAX"))

        guard case .choice(let options, _, _) = try XCTUnwrap(session.cards.first?.interaction) else {
            return XCTFail("Expected choice interaction")
        }

        XCTAssertEqual(options.map(\.text), ["approve", "audit"])
        XCTAssertEqual(options.map(\.isCorrect), [false, true])
    }
}

private final class DecodingStubAPIClient: APIClient {
    let jsonResponse: String

    init(jsonResponse: String) {
        self.jsonResponse = jsonResponse
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T : Decodable {
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: Data(jsonResponse.utf8))
    }
}
