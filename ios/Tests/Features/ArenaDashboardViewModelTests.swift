import XCTest
@testable import OpusApp

final class ArenaDashboardViewModelTests: XCTestCase {
    @MainActor
    func testLoadsOverview() async {
        let viewModel = ArenaDashboardViewModel(service: StubArenaDashboardService())

        await viewModel.loadOverview(force: true)

        XCTAssertEqual(viewModel.overview?.radar.count, 1)
    }

    @MainActor
    func testSwitchingDomainClearsSelectedKnot() async {
        let viewModel = ArenaDashboardViewModel(service: StubArenaDashboardService())
        viewModel.selectedKnot = ArenaMatrixKnot(id: "node-1", name: "Present Perfect", nameEn: nil, shortCode: "PP", masteryScore: 42, availableQs: 8)

        viewModel.switchDomain("L1_CLAUSES")

        XCTAssertNil(viewModel.selectedKnot)
        XCTAssertEqual(viewModel.selectedDomain, "L1_CLAUSES")
    }
}

private struct StubArenaDashboardService: ArenaDashboardServing {
    func fetchOverview() async throws -> ArenaOverviewPayload {
        ArenaOverviewPayload(
            radar: [ArenaRadarDomain(code: "L1_VERBS", label: "动词逻辑", score: 52)],
            weakNodes: []
        )
    }

    func fetchMatrix(domain: String) async throws -> ArenaMatrixPayload? {
        ArenaMatrixPayload(
            l1Node: ArenaMatrixNode(code: domain, name: "Domain"),
            categories: []
        )
    }
}
