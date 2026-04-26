import Foundation

protocol DrivePlaylistServing {
    func fetchPlaylist(mode: String, track: String, batchSize: Int) async throws -> DrivePlaylist
}

protocol DriveTTSServing {
    func generateTTS(text: String, voice: String, speed: Double) async throws -> DriveTTSResult
}

struct DriveService: DrivePlaylistServing, DriveTTSServing {
    let apiClient: APIClient

    func fetchPlaylist(mode: String, track: String = "VISUAL", batchSize: Int = 50) async throws -> DrivePlaylist {
        let envelope = try await apiClient.send(
            DrivePlaylistEndpoint(mode: mode, track: track, batchSize: batchSize),
            as: MobileEnvelope<DrivePlaylistPayload>.self
        )

        return DrivePlaylist(
            mode: envelope.data.mode,
            track: envelope.data.track,
            batchSize: envelope.data.batchSize,
            items: envelope.data.items
        )
    }

    func generateTTS(text: String, voice: String, speed: Double) async throws -> DriveTTSResult {
        let envelope = try await apiClient.send(
            DriveTTSEndpoint(request: DriveTTSRequest(text: text, voice: voice, speed: speed)),
            as: MobileEnvelope<DriveTTSPayload>.self
        )

        guard let url = URL(string: envelope.data.audioURL) else {
            throw DriveServiceError.invalidAudioURL
        }

        return DriveTTSResult(
            audioURL: url,
            cached: envelope.data.cached,
            hash: envelope.data.hash
        )
    }
}

enum DriveServiceError: Error {
    case invalidAudioURL
}

private struct DrivePlaylistEndpoint: Endpoint {
    let path = "/api/mobile/v1/drive/playlist"
    let method: HTTPMethod = .get
    let mode: String
    let track: String
    let batchSize: Int

    var queryItems: [URLQueryItem] {
        [
            URLQueryItem(name: "mode", value: mode),
            URLQueryItem(name: "track", value: track),
            URLQueryItem(name: "batch", value: String(batchSize)),
        ]
    }
}

private struct DriveTTSEndpoint: Endpoint {
    let path = "/api/mobile/v1/tts/generate"
    let method: HTTPMethod = .post
    let request: DriveTTSRequest

    var body: Data? {
        try? JSONSerialization.data(withJSONObject: [
            "text": request.text,
            "voice": request.voice,
            "language": "en-US",
            "speed": request.speed,
            "cacheType": "phrase",
        ])
    }
}

private struct DrivePlaylistPayload: Decodable {
    let mode: String
    let track: String
    let batchSize: Int
    let items: [DriveItem]
}

private struct DriveTTSPayload: Decodable {
    let url: String
    let audioURL: String
    let cached: Bool
    let hash: String

    private enum CodingKeys: String, CodingKey {
        case url
        case audioURL = "audioUrl"
        case cached
        case hash
    }
}
