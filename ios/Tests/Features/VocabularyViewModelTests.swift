import XCTest
@testable import OpusApp

final class VocabularyViewModelTests: XCTestCase {
    @MainActor
    func testLoadsVocabularyList() async {
        let viewModel = VocabularyViewModel(service: StubVocabularyService())

        await viewModel.load(force: true)

        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertEqual(viewModel.tags, ["finance"])
    }

    @MainActor
    func testLoadsDetailSeparately() async {
        let viewModel = VocabularyViewModel(service: StubVocabularyService())

        await viewModel.loadDetail(id: 1)

        XCTAssertEqual(viewModel.selectedDetail?.vocab.word, "audit")
    }
}

private struct StubVocabularyService: VocabularyServing {
    func fetchList(page: Int, search: String, status: VocabularyStatus, sort: VocabularySort, tagFilter: String?) async throws -> VocabularyListPayload {
        VocabularyListPayload(
            items: [
                VocabularyListItem(
                    id: 1,
                    word: "audit",
                    phonetic: "/ˈɔːdɪt/",
                    definition: "审计",
                    abceedRank: 12,
                    fsrs: VocabularyFSRS(
                        status: "REVIEW",
                        stability: 3,
                        difficulty: 5,
                        retention: 88,
                        nextReview: nil,
                        lapses: 0,
                        isLeech: false,
                        hasContext: true,
                        contextSentence: nil
                    )
                )
            ],
            metadata: VocabularyListMetadata(
                total: 1,
                page: 1,
                totalPages: 1,
                hasMore: false,
                stats: VocabularyStats(mastered: 1, learning: 2, due: 3, totalVocab: 10)
            )
        )
    }

    func fetchTags() async throws -> [String] {
        ["finance"]
    }

    func fetchDetail(id: Int) async throws -> VocabularyDetailPayload {
        VocabularyDetailPayload(
            vocab: VocabularyDetail(
                id: id,
                word: "audit",
                phoneticUs: "/ˈɔːdɪt/",
                phoneticUk: nil,
                definition_cn: "审计",
                definition_jp: nil,
                partOfSpeech: "noun"
            ),
            userTags: ["finance"],
            userNote: "记住 quarterly audit"
        )
    }
}
