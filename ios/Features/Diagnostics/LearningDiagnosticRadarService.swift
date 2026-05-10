import Foundation

protocol LearningDiagnosticRadarServing {
    func fetchRadar() async throws -> LearningDiagnosticRadarPayload
}

struct LearningDiagnosticRadarService: LearningDiagnosticRadarServing {
    let apiClient: APIClient

    func fetchRadar() async throws -> LearningDiagnosticRadarPayload {
        let envelope = try await apiClient.send(
            LearningDiagnosticRadarEndpoint(),
            as: MobileEnvelope<LearningDiagnosticRadarPayload>.self
        )
        return envelope.data
    }
}

struct LearningDiagnosticRadarEndpoint: Endpoint {
    let path = "/api/mobile/v1/diagnostics/radar"
    let method: HTTPMethod = .get
}
