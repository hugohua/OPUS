import Foundation
import Observation

@MainActor
@Observable
final class BriefingViewModel {
    var contentState: OpusContentState = .loading
    var historyContentState: OpusContentState = .loading
    var phase: BriefingPhase = .console
    var latest: BriefingLatestPayload?
    var currentArticle: BriefingArticlePayload?
    var selectedScenario = "finance_group"
    var selectedDensity = "balanced"
    var selectedHistoryScenario: BriefingScenarioOption?
    var selectedHistoryStatus: BriefingHistoryStatusFilter = .all
    var priorityWords: [BriefingWord] = []
    var fillerWords: [BriefingWord] = []
    var historyItems: [BriefingHistoryItem] = []
    var historyAvailableScenarios: [BriefingScenarioOption] = []
    var historyErrorMessage: String?
    var generatedText = ""
    var generationError: String?
    var isReaderLoading = false
    var readerError: String?
    var isWandSheetPresented = false
    var wandSelection = ""
    var wandLookup: BriefingWandWordPayload?
    var wandAnalysisText = ""
    var wandError: String?
    var isWandLoading = false
    var isWandAnalyzing = false

    @ObservationIgnored private let service: BriefingServing
    @ObservationIgnored private var readerReturnTarget: BriefingReaderReturnTarget = .console

    init(service: BriefingServing) {
        self.service = service
    }

    func loadInitialData() async {
        contentState = .loading
        historyContentState = .loading
        historyErrorMessage = nil

        do {
            async let latestRequest = service.fetchLatest()
            async let ingredientsRequest = service.fetchIngredients(scenario: selectedScenario, refresh: false)

            latest = try await latestRequest
            let ingredients = try await ingredientsRequest
            applyIngredients(ingredients)
            contentState = .empty(title: "", message: "")
        } catch {
            contentState = .error(
                title: "简报模块加载失败",
                message: "最新简报或词汇食材暂时不可用。",
                actionTitle: "重试"
            )
        }

        await reloadHistory()
    }

    func refreshIngredients() async {
        do {
            let ingredients = try await service.fetchIngredients(scenario: selectedScenario, refresh: true)
            applyIngredients(ingredients)
        } catch {
            generationError = "词汇食材刷新失败"
        }
    }

    func startGeneration() async {
        phase = .generating
        generatedText = ""
        generationError = nil
        readerError = nil
        currentArticle = nil

        do {
            let stream = try service.generate(
                scenario: selectedScenario,
                density: selectedDensity,
                targetWordIds: (priorityWords + fillerWords).map(\.id)
            )

            for try await event in stream {
                switch event {
                case .content(let text):
                    generatedText.append(text)
                case .done:
                    await finalizeGeneratedArticle()
                case .error(let error):
                    generationError = error
                    phase = .console
                }
            }
        } catch {
            generationError = error.localizedDescription
            phase = .console
        }
    }

    func resetToConsole() {
        phase = .console
        isReaderLoading = false
        readerError = nil
    }

    func openLatestBriefing(articleID: String?) async {
        let targetID = articleID ?? latest?.id
        guard let targetID else {
            return
        }

        await openArticle(id: targetID, returnTarget: .console)
    }

    func openArticle(id: String, returnTarget: BriefingReaderReturnTarget) async {
        readerReturnTarget = returnTarget
        phase = .reader
        isReaderLoading = true
        readerError = nil
        currentArticle = nil

        do {
            currentArticle = try await service.fetchArticle(id: id)
            generatedText = currentArticle?.content ?? ""
            generationError = nil
        } catch {
            readerError = "简报详情加载失败"
        }

        isReaderLoading = false
    }

    func closeReader() {
        switch readerReturnTarget {
        case .console:
            resetToConsole()
        case .history:
            resetToConsole()
        }
    }

    func reloadHistory() async {
        historyContentState = .loading
        historyErrorMessage = nil

        do {
            let payload = try await service.fetchHistory(
                scenario: selectedHistoryScenario?.rawValue,
                status: selectedHistoryStatus.rawValue.isEmpty ? nil : selectedHistoryStatus.rawValue
            )
            applyHistory(payload)
        } catch {
            historyItems = []
            historyContentState = .error(
                title: "历史记录不可用",
                message: "无法同步阅读历史与筛选结果。",
                actionTitle: "重试"
            )
        }
    }

    func openHistoryArticle(id: String) async {
        await openArticle(id: id, returnTarget: .history)
    }

    func confirmDeleteHistoryArticle(id: String) async {
        historyErrorMessage = nil

        do {
            try await service.deleteArticle(id: id)
            await reloadHistory()
        } catch {
            historyErrorMessage = "删除失败，请稍后重试。"
        }
    }

    func lookupSelection(_ word: String) async {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        wandSelection = trimmed
        wandLookup = nil
        wandAnalysisText = ""
        wandError = nil
        isWandLoading = true
        isWandAnalyzing = false
        isWandSheetPresented = true

        do {
            wandLookup = try await service.fetchWandWord(word: trimmed)
        } catch {
            wandError = "查词失败，请稍后重试。"
        }

        isWandLoading = false
    }

    func analyzeSelection(_ text: String, context: String?) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        wandSelection = trimmed
        wandLookup = nil
        wandAnalysisText = ""
        wandError = nil
        isWandLoading = true
        isWandAnalyzing = true
        isWandSheetPresented = true

        let type: BriefingWandAnalyzeType = trimmed.contains(" ") ? .sentence : .word

        do {
            let stream = try service.analyze(text: trimmed, type: type, context: context)
            isWandLoading = false

            for try await event in stream {
                switch event {
                case .content(let content):
                    wandAnalysisText.append(content)
                case .done:
                    isWandAnalyzing = false
                case .error(let message):
                    wandError = message
                    isWandAnalyzing = false
                }
            }
        } catch {
            isWandLoading = false
            isWandAnalyzing = false
            wandError = error.localizedDescription
        }
    }

    func dismissWand() {
        isWandSheetPresented = false
        wandSelection = ""
        wandLookup = nil
        wandAnalysisText = ""
        wandError = nil
        isWandLoading = false
        isWandAnalyzing = false
    }

    func resetForSessionChange() {
        contentState = .loading
        historyContentState = .loading
        phase = .console
        latest = nil
        currentArticle = nil
        selectedScenario = "finance_group"
        selectedDensity = "balanced"
        selectedHistoryScenario = nil
        selectedHistoryStatus = .all
        priorityWords = []
        fillerWords = []
        historyItems = []
        historyAvailableScenarios = []
        historyErrorMessage = nil
        generatedText = ""
        generationError = nil
        isReaderLoading = false
        readerError = nil
        dismissWand()
    }

    private func applyIngredients(_ payload: BriefingIngredientsPayload) {
        selectedScenario = payload.scenario
        priorityWords = payload.priorityWords
        fillerWords = payload.fillerWords
    }

    private func applyHistory(_ payload: BriefingHistoryPayload) {
        historyItems = payload.items
        historyAvailableScenarios = payload.availableScenarios.compactMap(BriefingScenarioOption.init(rawValue:))
        historyContentState = payload.items.isEmpty
            ? .empty(
                title: historyEmptyTitle,
                message: historyEmptyMessage
            )
            : .empty(title: "", message: "")
    }

    private var historyEmptyTitle: String {
        if selectedHistoryScenario != nil || selectedHistoryStatus != .all {
            return "没有匹配的历史简报"
        }
        return "还没有历史简报"
    }

    private var historyEmptyMessage: String {
        if selectedHistoryScenario != nil || selectedHistoryStatus != .all {
            return "可以切换场景或新旧状态后重新查看。"
        }
        return "生成并阅读过的简报会出现在这里。"
    }

    private func finalizeGeneratedArticle() async {
        let title = generatedText
            .components(separatedBy: "\n")
            .drop { !$0.contains("===TITLE===") }
            .dropFirst()
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            ?? "最新简报"

        currentArticle = BriefingArticlePayload.ephemeral(
            title: title,
            createdAt: ISO8601DateFormatter().string(from: .now),
            scenario: selectedScenario,
            density: selectedDensity,
            content: generatedText,
            targetWords: priorityWords + fillerWords
        )

        if let refreshedLatest = try? await service.fetchLatest(),
           refreshedLatest.content == generatedText,
           let fetchedArticle = try? await service.fetchArticle(id: refreshedLatest.id) {
            latest = refreshedLatest
            currentArticle = fetchedArticle
        }

        phase = .reader
        isReaderLoading = false
        readerError = nil
    }
}
