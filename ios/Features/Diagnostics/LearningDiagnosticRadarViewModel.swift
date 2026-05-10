import Foundation
import Observation

@MainActor
@Observable
final class LearningDiagnosticRadarViewModel {
    var contentState: OpusContentState = .loading
    var payload: LearningDiagnosticRadarPayload?

    @ObservationIgnored private let service: LearningDiagnosticRadarServing
    @ObservationIgnored private var hasLoaded = false

    init(service: LearningDiagnosticRadarServing) {
        self.service = service
    }

    func load(force: Bool = false) async {
        if hasLoaded && !force { return }
        contentState = .loading

        do {
            payload = try await service.fetchRadar()
            contentState = payload?.radarData.isEmpty == false
                ? .empty(title: "", message: "")
                : .empty(
                    title: "暂无综合诊断",
                    message: "完成 Arena 实战答题后，这里会显示你的题型表现。"
                )
            hasLoaded = true
        } catch {
            payload = nil
            contentState = .error(
                title: "综合诊断加载失败",
                message: "题型诊断暂时不可用，不影响继续训练。",
                actionTitle: "重试"
            )
        }
    }

    func resetForSessionChange() {
        contentState = .loading
        payload = nil
        hasLoaded = false
    }
}
