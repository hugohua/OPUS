import Foundation
import Observation

@MainActor
@Observable
final class BriefingViewModel {
    var contentState: OpusContentState = .loading
    var phase: BriefingPhase = .console
    var latest: BriefingLatestPayload?
    var selectedScenario = "finance_group"
    var selectedDensity = "balanced"
    var priorityWords: [BriefingWord] = []
    var fillerWords: [BriefingWord] = []
    var generatedText = ""
    var generationError: String?

    @ObservationIgnored private let service: BriefingServing

    init(service: BriefingServing) {
        self.service = service
    }

    func loadInitialData() async {
        contentState = .loading

        do {
            latest = try await service.fetchLatest()
            let ingredients = try await service.fetchIngredients(scenario: selectedScenario, refresh: false)
            applyIngredients(ingredients)
            contentState = .empty(title: "", message: "")
        } catch {
            contentState = .error(
                title: "简报模块加载失败",
                message: "最新简报或词汇食材暂时不可用。",
                actionTitle: "重试"
            )
        }
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
                    phase = .reader
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
    }

    func openLatestBriefing(articleID: String?) {
        guard let articleID,
              let latest,
              latest.id == articleID else {
            return
        }

        generatedText = latest.content
        generationError = nil
        phase = .reader
    }

    func resetForSessionChange() {
        contentState = .loading
        phase = .console
        latest = nil
        selectedScenario = "finance_group"
        selectedDensity = "balanced"
        priorityWords = []
        fillerWords = []
        generatedText = ""
        generationError = nil
    }

    private func applyIngredients(_ payload: BriefingIngredientsPayload) {
        selectedScenario = payload.scenario
        priorityWords = payload.priorityWords
        fillerWords = payload.fillerWords
    }
}
