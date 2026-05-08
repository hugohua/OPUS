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
        await viewModel.openLatestBriefing(articleID: "article-1")

        XCTAssertEqual(viewModel.phase, .reader)
        XCTAssertEqual(viewModel.currentArticle?.id, "article-1")
    }

    @MainActor
    func testMovesToReaderAfterStreamingDone() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.startGeneration()

        XCTAssertEqual(viewModel.phase, .reader)
        XCTAssertTrue(viewModel.generatedText.contains("hello"))
    }

    @MainActor
    func testLooksUpSelectedWord() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.lookupSelection("audit")

        XCTAssertTrue(viewModel.isWandSheetPresented)
        XCTAssertEqual(viewModel.wandLookup?.vocab.meaning, "审计")
        XCTAssertNil(viewModel.wandError)
    }

    @MainActor
    func testStreamsSentenceAnalysisIntoWandSheet() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.analyzeSelection("The audit starts today.", context: "The audit starts today.")

        XCTAssertTrue(viewModel.isWandSheetPresented)
        XCTAssertFalse(viewModel.isWandAnalyzing)
        XCTAssertEqual(viewModel.wandAnalysisText, "chunk-1 chunk-2")
    }

    @MainActor
    func testLoadsHistoryDuringInitialFetch() async {
        let service = SpyBriefingService()
        let viewModel = BriefingViewModel(service: service)

        await viewModel.loadInitialData()

        XCTAssertEqual(viewModel.historyItems.count, 2)
        XCTAssertEqual(viewModel.historyContentState, .empty(title: "", message: ""))
    }

    @MainActor
    func testReloadsHistoryWhenFiltersChange() async {
        let service = SpyBriefingService()
        let viewModel = BriefingViewModel(service: service)

        await viewModel.loadInitialData()
        viewModel.selectedHistoryScenario = .financeGroup
        viewModel.selectedHistoryStatus = .new
        await viewModel.reloadHistory()

        XCTAssertEqual(service.recordedHistoryRequests.last?.scenario, "finance_group")
        XCTAssertEqual(service.recordedHistoryRequests.last?.status, "new")
    }

    @MainActor
    func testDeleteHistoryArticleRefreshesList() async {
        let service = SpyBriefingService()
        let viewModel = BriefingViewModel(service: service)

        await viewModel.loadInitialData()
        await viewModel.confirmDeleteHistoryArticle(id: "article-1")

        XCTAssertEqual(service.deletedArticleIDs, ["article-1"])
        XCTAssertEqual(viewModel.historyItems.map(\.id), ["article-2"])
    }

    @MainActor
    func testAppliesPendingBriefingDestinations() async {
        let viewModel = BriefingViewModel(service: StubBriefingService())

        await viewModel.loadInitialData()
        await viewModel.applyPendingDestination(.briefingHistory)
        XCTAssertEqual(viewModel.phase, .console)
        XCTAssertTrue(viewModel.isHistoryFocused)

        await viewModel.applyPendingDestination(.briefingComposer)
        XCTAssertEqual(viewModel.phase, .console)
        XCTAssertFalse(viewModel.isHistoryFocused)
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

    func fetchHistory(scenario: String?, status: String?) async throws -> BriefingHistoryPayload {
        BriefingHistoryPayload(items: [], availableScenarios: [])
    }

    func deleteArticle(id: String) async throws {}

    func fetchArticle(id: String) async throws -> BriefingArticlePayload {
        BriefingArticlePayload(
            id: id,
            title: "Quarterly Audit",
            createdAt: "2026-04-22T00:00:00Z",
            summaryZh: "",
            scenario: "finance_group",
            density: "balanced",
            content: "===TITLE===\nQuarterly Audit\n===BODY===\nBriefing body\n===TRANSLATION===\n简报正文",
            targetWords: [BriefingWord(id: 1, word: "audit", meaning: "审计")]
        )
    }

    func fetchWandWord(word: String) async throws -> BriefingWandWordPayload {
        BriefingWandWordPayload(
            vocab: BriefingWandVocab(phonetic: "/ˈɔːdɪt/", meaning: "审计"),
            etymology: BriefingWandEtymology(mode: "ROOTS", memoryHook: "audire", data: ["root": "aud"]),
            aiInsight: nil
        )
    }

    func analyze(text: String, type: BriefingWandAnalyzeType, context: String?) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(.content("chunk-1 "))
            continuation.yield(.content("chunk-2"))
            continuation.yield(.done)
            continuation.finish()
        }
    }

    func generate(scenario: String, density: String, targetWordIds: [Int]) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(.content("hello"))
            continuation.yield(.done)
            continuation.finish()
        }
    }
}

@MainActor
private final class SpyBriefingService: @preconcurrency BriefingServing {
    var recordedHistoryRequests: [(scenario: String?, status: String?)] = []
    var deletedArticleIDs: [String] = []
    private var historyItems: [BriefingHistoryItem] = [
        BriefingHistoryItem(
            id: "article-1",
            title: "Finance memo",
            createdAt: "2026-04-23T10:00:00Z",
            scenario: "finance_group",
            status: "new",
            vocabPreview: "audit"
        ),
        BriefingHistoryItem(
            id: "article-2",
            title: "HR memo",
            createdAt: "2026-04-21T10:00:00Z",
            scenario: "hr_group",
            status: "archived",
            vocabPreview: "policy"
        ),
    ]

    func fetchLatest() async throws -> BriefingLatestPayload? {
        try await StubBriefingService().fetchLatest()
    }

    func fetchIngredients(scenario: String, refresh: Bool) async throws -> BriefingIngredientsPayload {
        try await StubBriefingService().fetchIngredients(scenario: scenario, refresh: refresh)
    }

    func fetchHistory(scenario: String?, status: String?) async throws -> BriefingHistoryPayload {
        recordedHistoryRequests.append((scenario, status))

        let filtered = historyItems.filter { item in
            let scenarioMatches = scenario == nil || item.scenario == scenario
            let statusMatches = status == nil || item.status == status
            return scenarioMatches && statusMatches
        }

        return BriefingHistoryPayload(
            items: filtered,
            availableScenarios: ["finance_group", "hr_group"]
        )
    }

    func deleteArticle(id: String) async throws {
        deletedArticleIDs.append(id)
        historyItems.removeAll { $0.id == id }
    }

    func fetchArticle(id: String) async throws -> BriefingArticlePayload {
        try await StubBriefingService().fetchArticle(id: id)
    }

    func fetchWandWord(word: String) async throws -> BriefingWandWordPayload {
        try await StubBriefingService().fetchWandWord(word: word)
    }

    func analyze(text: String, type: BriefingWandAnalyzeType, context: String?) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        try StubBriefingService().analyze(text: text, type: type, context: context)
    }

    func generate(scenario: String, density: String, targetWordIds: [Int]) throws -> AsyncThrowingStream<SSEClientEvent, Error> {
        try StubBriefingService().generate(scenario: scenario, density: density, targetWordIds: targetWordIds)
    }
}
