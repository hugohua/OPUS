import XCTest
@testable import OpusApp

final class ArenaPart5ServiceTests: XCTestCase {
    func testMarksStringOptionsUsingAnswerKey() async throws {
        let apiClient = ArenaDecodingStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "count": 1,
            "items": [
              {
                "meta": {
                  "mode": "ARENA_PART5",
                  "vocabId": 0,
                  "questionSeedId": "seed-1"
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
        let service = ArenaPart5Service(apiClient: apiClient)

        let questions = try await service.fetchQuestions(ArenaPart5FetchRequest(grammarNodeID: nil, limit: 10))

        XCTAssertEqual(questions.first?.options.map(\.text), ["approve", "audit"])
        XCTAssertEqual(questions.first?.options.map(\.isCorrect), [false, true])
    }
}

private final class ArenaDecodingStubAPIClient: APIClient {
    let jsonResponse: String

    init(jsonResponse: String) {
        self.jsonResponse = jsonResponse
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T : Decodable {
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: Data(jsonResponse.utf8))
    }
}
