import Foundation

struct ArenaOverviewPayload: Decodable {
    let radar: [ArenaRadarDomain]
    let weakNodes: [ArenaWeakNode]
}

struct ArenaRadarDomain: Decodable, Equatable, Identifiable {
    let code: String
    let label: String
    let score: Int

    var id: String { code }
}

struct ArenaWeakNode: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let description: String
    let score: Int
}

struct ArenaMatrixPayload: Decodable, Equatable {
    let l1Node: ArenaMatrixNode
    let categories: [ArenaMatrixCategory]
}

struct ArenaMatrixNode: Decodable, Equatable {
    let code: String
    let name: String
}

struct ArenaMatrixCategory: Decodable, Equatable, Identifiable {
    let l2Node: ArenaMatrixL2Node
    let knots: [ArenaMatrixKnot]

    var id: String { l2Node.id }
}

struct ArenaMatrixL2Node: Decodable, Equatable {
    let id: String
    let name: String
    let nameEn: String?
}

struct ArenaMatrixKnot: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let nameEn: String?
    let shortCode: String
    let masteryScore: Int
    let availableQs: Int
}
