import Foundation

struct DrivePlaylist: Equatable {
    let mode: String
    let track: String
    let batchSize: Int
    let items: [DriveItem]
}

struct DriveItem: Decodable, Equatable, Identifiable {
    let id: String
    let text: String
    let trans: String
    let phonetic: String
    let ttsPhrase: String?
    let word: String
    let pos: String
    let meaning: String
    let mode: String
    let voice: String
    let speed: Double
}

struct DriveTTSRequest: Equatable {
    let text: String
    let voice: String
    let speed: Double
}

struct DriveTTSResult: Equatable {
    let audioURL: URL
    let cached: Bool
    let hash: String
}

enum DrivePlaybackStage: Equatable {
    case idle
    case word
    case phrase
    case meaning
}
