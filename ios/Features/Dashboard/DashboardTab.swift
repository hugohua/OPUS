import Foundation

enum DashboardTab: String, CaseIterable, Identifiable {
    case home
    case training
    case arena
    case vocabulary
    case briefing

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:
            return "首页"
        case .training:
            return "模拟"
        case .arena:
            return "竞技"
        case .vocabulary:
            return "词库"
        case .briefing:
            return "简报"
        }
    }

    var systemImage: String {
        switch self {
        case .home:
            return "house"
        case .training:
            return "bolt"
        case .arena:
            return "shield.lefthalf.filled"
        case .vocabulary:
            return "square.stack.3d.up"
        case .briefing:
            return "sparkles"
        }
    }
}
