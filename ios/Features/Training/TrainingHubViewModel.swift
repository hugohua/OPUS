import Foundation
import Observation

@MainActor
@Observable
final class TrainingHubViewModel {
    var contentState: OpusContentState = .loading
    var sections: [TrainingHubSection] = []
    var activeDestination: DashboardDestination?

    @ObservationIgnored private let service: TrainingHubServing
    @ObservationIgnored private var hasLoaded = false

    init(service: TrainingHubServing) {
        self.service = service
    }

    func load(force: Bool = false) async {
        if hasLoaded && !force { return }
        contentState = .loading

        do {
            sections = try await service.fetchTrainingSections()
            contentState = sections.isEmpty
                ? .empty(
                    title: "训练页暂无内容",
                    message: "训练入口还没有准备好，请稍后再试。"
                )
                : .empty(title: "", message: "")
            hasLoaded = true
        } catch {
            contentState = .error(
                title: "训练页加载失败",
                message: "入口状态暂时不可用，请检查本地 API 与登录状态。",
                actionTitle: "重试"
            )
        }
    }

    func open(_ destination: DashboardDestination) {
        activeDestination = destination
    }

    func resetForSessionChange() {
        contentState = .loading
        sections = []
        activeDestination = nil
        hasLoaded = false
    }
}
