import XCTest
@testable import OpusApp

final class SessionRunnerServiceTests: XCTestCase {
    func testPhraseDisplayRemovesRepeatedTargetWordPrefixFromDefinition() {
        let display = SessionRunnerPhraseDisplay(
            targetWord: "deadline",
            definition: "deadline: 截止日期"
        )

        XCTAssertEqual(display.cleanedDefinition, "截止日期")
    }

    func testPhraseDisplaySplitsMorphologyLogicAtFirstArrow() {
        let display = SessionRunnerPhraseDisplay(
            targetWord: "compile",
            definition: "汇编",
            logic: "com(一起) + pile(堆叠) → 把分散的信息堆叠、整理到一起 → 汇编/编辑"
        )

        XCTAssertEqual(display.logicLead, "com(一起) + pile(堆叠)")
        XCTAssertEqual(display.logicResult, "把分散的信息堆叠、整理到一起 → 汇编/编辑")
    }

    func testMapsPhrasePayloadToFlashcardEvenWhenOptionsArePresent() async throws {
        let apiClient = DecodingStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "count": 1,
            "items": [
              {
                "meta": {
                  "mode": "PHRASE",
                  "vocabId": 42,
                  "target_word": "initially",
                  "definition_cn": "最初地",
                  "userNote": "一开始先 init",
                  "etymology": {
                    "mode": "DERIVATIVE",
                    "memory_hook": null,
                    "data": {
                      "logic_cn": "源自 initial(最初的) + ly(副词后缀) → 在开始的时候 → 最初/起初",
                      "roots": [
                        { "part": "initial", "meaning_cn": "最初的" },
                        { "part": "-ly", "meaning_cn": "副词后缀" }
                      ]
                    }
                  }
                },
                "segments": [
                  {
                    "type": "text",
                    "content_markdown": "**initially** planned",
                    "translation_cn": "最初计划的",
                    "phonetic": "ɪˈnɪʃəli"
                  },
                  {
                    "type": "interaction",
                    "task": {
                      "style": "bubble_select",
                      "question_markdown": "**initially** planned",
                      "options": ["Forgot", "Blurry", "Know"],
                      "answer_key": "Know"
                    }
                  }
                ],
                "fsrsPreview": {
                  "again": "<1m",
                  "hard": "<1m",
                  "good": "1d",
                  "easy": "1d"
                }
              }
            ]
          }
        }
        """)
        let service = SessionRunnerService(apiClient: apiClient)

        let session = try await service.fetchSession(for: .training(mode: "PHRASE"))
        let card = try XCTUnwrap(session.cards.first)

        guard case .phraseFlashcard(let phrase) = card.interaction else {
            return XCTFail("Expected phrase flashcard interaction")
        }

        XCTAssertEqual(card.title, "initially")
        XCTAssertEqual(card.prompt, "**initially** planned")
        XCTAssertEqual(card.supportingText, "最初计划的")
        XCTAssertEqual(phrase.phraseMarkdown, "**initially** planned")
        XCTAssertEqual(phrase.translation, "最初计划的")
        XCTAssertEqual(phrase.targetWord, "initially")
        XCTAssertEqual(phrase.definition, "最初地")
        XCTAssertEqual(phrase.phonetic, "ɪˈnɪʃəli")
        XCTAssertEqual(phrase.userNote, "一开始先 init")
        XCTAssertEqual(phrase.etymology?.logic, "源自 initial(最初的) + ly(副词后缀) → 在开始的时候 → 最初/起初")
        XCTAssertEqual(phrase.etymology?.components, [
            SessionRunnerEtymologyPart(part: "initial", meaningCN: "最初的"),
            SessionRunnerEtymologyPart(part: "-ly", meaningCN: "副词后缀")
        ])
        XCTAssertEqual(phrase.fsrsPreview, SessionRunnerFSRSPreview(
            again: "<1m",
            hard: "<1m",
            good: "1d",
            easy: "1d"
        ))
    }

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
