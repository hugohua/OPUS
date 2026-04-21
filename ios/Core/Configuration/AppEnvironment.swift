import Foundation

enum AppEnvironment: String, CaseIterable, Equatable {
    case local
    case staging
    case production

    var title: String {
        rawValue.capitalized
    }
}
