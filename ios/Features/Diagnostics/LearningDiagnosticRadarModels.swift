import Foundation

struct LearningDiagnosticRadarPayload: Decodable, Equatable {
    let radarData: [LearningDiagnosticRadarPoint]
    let weakest: LearningDiagnosticWeaknessProfile?
    let totalAttempts: Int
}

struct LearningDiagnosticRadarPoint: Decodable, Equatable, Identifiable {
    let subject: String
    let A: Int
    let fullMark: Int

    var id: String { subject }
    var score: Int { A }
}

struct LearningDiagnosticWeaknessProfile: Decodable, Equatable {
    let questionType: String
    let label: String
    let total: Int
    let correct: Int
    let accuracy: Int
    let avgResponseMs: Int
}
