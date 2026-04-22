import XCTest
@testable import OpusApp

final class BriefingViewModelTests: XCTestCase {
    @MainActor
    func testLoadsInitialIngredients() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.loadInitialData()

        XCTAssertEqual(viewModel.priorityWords.count, 1)
        XCTAssertEqual(viewModel.phase, .console)
    }

    @MainActor
    func testOpensPendingLatestBriefingIntoReader() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.loadInitialData()
        viewModel.openLatestBriefing(articleID: "article-1")

        XCTAssertEqual(viewModel.phase, .reader)
        XCTAssertTrue(viewModel.generatedText.contains("Briefing body"))
    }

    @MainActor
    func testMovesToReaderAfterStreamingDone() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.startGeneration()

        XCTAssertEqual(viewModel.phase, .reader)
        XCTAssertTrue(viewModel.generatedText.contains("hello"))
    }
}

private struct StubBriefingService: BriefingServing {
    func fetchLatest() async throws -> BriefingLatestPayload? {
        BriefingLatestPayload(
            id: "article-1",
            title: "Quarterly Audit",
            createdAt: "2026-04-22T00:00:00Z",
            scenario: "finance_group",
            density: "balanced",
            content: "Briefing body"
        )
    }

    func fetchIngredients(scenario: String, refresh: Bool) async throws -> BriefingIngredientsPayload {
        BriefingIngredientsPayload(
            scenario: scenario,
            priorityWords: [BriefingWord(id: 1, word: "audit", meaning: "审计")],
            fillerWords: [],
            availableScenarios: ["finance_group"],
            availableDensities: ["balanced"]
        )
    }

    func generate(scenario: String, density: String, targetWordIds: [Int]) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(.content("hello"))
            continuation.yield(.done)
            continuation.finish()
        }
    }
}
