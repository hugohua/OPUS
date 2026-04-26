import XCTest
@testable import OpusApp

final class DriveServiceTests: XCTestCase {
    func testFetchPlaylistDecodesMobileDriveEnvelope() async throws {
        let apiClient = DriveDecodingStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "mode": "SANDWICH",
            "track": "VISUAL",
            "batchSize": 30,
            "items": [
              {
                "id": "1",
                "text": "audit",
                "trans": "审计",
                "phonetic": "/ˈɔːdɪt/",
                "ttsPhrase": "conduct an audit",
                "word": "audit",
                "pos": "n.",
                "meaning": "审计",
                "mode": "QUIZ",
                "voice": "Kai",
                "speed": 0.9
              }
            ]
          }
        }
        """)
        let service = DriveService(apiClient: apiClient)

        let playlist = try await service.fetchPlaylist(mode: "SANDWICH", track: "VISUAL", batchSize: 30)

        XCTAssertEqual(apiClient.lastEndpointPath, "/api/mobile/v1/drive/playlist")
        XCTAssertEqual(apiClient.lastQueryItems["mode"], "SANDWICH")
        XCTAssertEqual(apiClient.lastQueryItems["track"], "VISUAL")
        XCTAssertEqual(apiClient.lastQueryItems["batch"], "30")
        XCTAssertEqual(playlist.mode, "SANDWICH")
        XCTAssertEqual(playlist.items.first?.ttsPhrase, "conduct an audit")
    }

    func testGenerateTTSDecodesAbsoluteAudioURL() async throws {
        let apiClient = DriveDecodingStubAPIClient(jsonResponse: """
        {
          "status": "success",
          "data": {
            "url": "/audio/audit.wav",
            "audioUrl": "http://localhost:3000/audio/audit.wav",
            "cached": true,
            "hash": "hash-1"
          }
        }
        """)
        let service = DriveService(apiClient: apiClient)

        let result = try await service.generateTTS(text: "audit", voice: "Kai", speed: 0.9)

        XCTAssertEqual(apiClient.lastEndpointPath, "/api/mobile/v1/tts/generate")
        XCTAssertEqual(result.audioURL.absoluteString, "http://localhost:3000/audio/audit.wav")
        XCTAssertTrue(result.cached)
    }
}

private final class DriveDecodingStubAPIClient: APIClient {
    let jsonResponse: String
    private(set) var lastEndpointPath: String?
    private(set) var lastQueryItems: [String: String] = [:]

    init(jsonResponse: String) {
        self.jsonResponse = jsonResponse
    }

    func send<T>(_ endpoint: Endpoint, as type: T.Type) async throws -> T where T: Decodable {
        lastEndpointPath = endpoint.path
        lastQueryItems = Dictionary(uniqueKeysWithValues: endpoint.queryItems.map { item in
            (item.name, item.value ?? "")
        })
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: Data(jsonResponse.utf8))
    }
}
