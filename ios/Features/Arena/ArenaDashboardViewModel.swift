import Foundation
import Observation

@MainActor
@Observable
final class ArenaDashboardViewModel {
    enum Tab: String, CaseIterable, Identifiable {
        case overview
        case matrix

        var id: String { rawValue }
    }

    var contentState: OpusContentState = .loading
    var selectedTab: Tab = .overview
    var selectedDomain: String = "L1_VERBS"
    var overview: ArenaOverviewPayload?
    var matrix: ArenaMatrixPayload?
    var selectedKnot: ArenaMatrixKnot?
    var activeDestination: DashboardDestination?

    @ObservationIgnored private let service: ArenaDashboardServing
    @ObservationIgnored private var hasLoadedOverview = false

    init(service: ArenaDashboardServing) {
        self.service = service
    }

    func loadOverview(force: Bool = false) async {
        if hasLoadedOverview && !force { return }
        contentState = .loading

        do {
            overview = try await service.fetchOverview()
            contentState = .empty(title: "", message: "")
            hasLoadedOverview = true
        } catch {
            contentState = .error(
                title: "竞技场加载失败",
                message: "概览数据暂时不可用，请稍后重试。",
                actionTitle: "重试"
            )
        }
    }

    func loadMatrix(force: Bool = false) async {
        if matrix != nil && !force { return }

        do {
            matrix = try await service.fetchMatrix(domain: selectedDomain)
        } catch {
            matrix = nil
        }
    }

    func switchTab(_ tab: Tab) {
        selectedTab = tab
        if tab == .matrix {
            Task {
                await loadMatrix()
            }
        }
    }

    func switchDomain(_ domain: String) {
        selectedDomain = domain
        selectedKnot = nil
        Task {
            await loadMatrix(force: true)
        }
    }

    func open(_ destination: DashboardDestination) {
        activeDestination = destination
    }

    func resetForSessionChange() {
        contentState = .loading
        selectedTab = .overview
        selectedDomain = "L1_VERBS"
        overview = nil
        matrix = nil
        selectedKnot = nil
        activeDestination = nil
        hasLoadedOverview = false
    }
}
