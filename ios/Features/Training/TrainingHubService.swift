import Foundation

protocol TrainingHubServing {
    func fetchTrainingSections() async throws -> [TrainingHubSection]
}

struct TrainingHubService: TrainingHubServing {
    let apiClient: APIClient

    func fetchTrainingSections() async throws -> [TrainingHubSection] {
        let envelope = try await apiClient.send(
            TrainingHubMatrixEndpoint(),
            as: MobileEnvelope<TrainingHubMatrixPayload>.self
        )

        return envelope.data.sections.map { section in
            TrainingHubSection(
                id: section.id,
                title: section.title,
                subtitle: section.subtitle,
                entries: section.entries.map(mapMatrixEntry)
            )
        }
    }

    private func fetchAudioAvailability() async throws -> TrainingHubAudioPayload {
        let envelope = try await apiClient.send(TrainingHubAudioEndpoint(), as: MobileEnvelope<TrainingHubAudioPayload>.self)
        return envelope.data
    }

    private func fetchReviewCards() async throws -> TrainingHubReviewCardsPayload {
        let envelope = try await apiClient.send(TrainingHubReviewCardsEndpoint(), as: MobileEnvelope<TrainingHubReviewCardsPayload>.self)
        return envelope.data
    }

    private func mapEntry(
        _ card: DashboardFeatureCard,
        audio: TrainingHubAudioPayload?,
        review: TrainingHubReviewCardsPayload?
    ) -> TrainingHubEntry {
        let availability: TrainingHubAvailability

        switch card.destination {
        case .audio:
            if let audio {
                availability = audio.available
                    ? .available(label: audio.count > 0 ? "\(audio.count) 个待练习" : nil)
                    : .unavailable(reason: audio.reason ?? "暂无待复习音频。")
            } else {
                availability = .unavailable(reason: "音频状态暂时不可用，请稍后重试。")
            }
        case .reviewCards:
            if let review {
                availability = review.count > 0
                    ? .available(label: "\(review.count) 张可复习")
                    : .unavailable(reason: "当前没有待复习卡片。")
            } else {
                availability = .unavailable(reason: "复习卡组状态暂时不可用，请稍后重试。")
            }
        default:
            availability = .available(label: nil)
        }

        return TrainingHubEntry(
            id: card.id,
            title: card.title,
            subtitle: card.subtitle,
            detail: card.detail,
            systemImage: card.systemImage,
            accent: card.accent,
            destination: card.destination,
            availability: availability
        )
    }

    private func mapMatrixEntry(_ entry: TrainingHubMatrixEntryPayload) -> TrainingHubEntry {
        TrainingHubEntry(
            id: entry.id,
            title: entry.title,
            subtitle: entry.subtitle,
            detail: entry.detail,
            systemImage: entry.systemImage,
            accent: accent(for: entry.accent),
            destination: destination(for: entry.destination),
            availability: .available(label: entry.queue.map { "\($0) 个待练习" } ?? entry.tag)
        )
    }

    private func accent(for rawValue: String) -> DashboardAccent {
        switch rawValue {
        case "emerald":
            return .emerald
        case "amber":
            return .amber
        case "rose":
            return .rose
        case "indigo":
            return .indigo
        case "cyan", "blue":
            return .blue
        case "violet":
            return .violet
        default:
            return .slate
        }
    }

    private func destination(for payload: TrainingHubMatrixDestinationPayload) -> DashboardDestination {
        switch (payload.kind, payload.value) {
        case ("diagnostics", let value):
            return .diagnostics(path: value)
        case ("arena", "mission"):
            return .arena(path: "mission")
        case ("arena", "part5"):
            return .arena(path: "part5")
        case ("briefing", "history"):
            return .briefingHistory
        case ("briefing", "console"):
            return .briefingComposer
        case ("training", let mode):
            return mode == "AUDIO" ? .audio : .training(mode: mode)
        default:
            return .training(mode: payload.value)
        }
    }
}

struct TrainingHubMatrixEndpoint: Endpoint {
    let path = "/api/mobile/v1/training/matrix"
    let method: HTTPMethod = .get
}

struct TrainingHubMatrixPayload: Decodable {
    let sections: [TrainingHubMatrixSectionPayload]
}

struct TrainingHubMatrixSectionPayload: Decodable {
    let id: String
    let title: String
    let subtitle: String?
    let entries: [TrainingHubMatrixEntryPayload]
}

struct TrainingHubMatrixEntryPayload: Decodable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let tag: String
    let systemImage: String
    let accent: String
    let destination: TrainingHubMatrixDestinationPayload
    let queue: Int?
}

struct TrainingHubMatrixDestinationPayload: Decodable {
    let kind: String
    let value: String
}

struct TrainingHubAudioEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/audio"
    let method: HTTPMethod = .get
}

struct TrainingHubReviewCardsEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/review-cards"
    let method: HTTPMethod = .get
}
