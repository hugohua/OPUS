import Foundation

protocol TrainingHubServing {
    func fetchTrainingSections() async throws -> [TrainingHubSection]
}

struct TrainingHubService: TrainingHubServing {
    let apiClient: APIClient

    func fetchTrainingSections() async throws -> [TrainingHubSection] {
        async let summaryState = DashboardSummaryService(apiClient: apiClient).fetchSummary()
        async let audioPayload = fetchAudioAvailability()
        async let reviewPayload = fetchReviewCards()

        let homeState = try await summaryState
        let audio = try? await audioPayload
        let review = try? await reviewPayload

        let coreEntries = homeState.trainingCards.map { card in
            mapEntry(card, audio: audio, review: review)
        }
        let skillEntries = homeState.skillCards.map { card in
            mapEntry(card, audio: audio, review: review)
        }

        return [
            TrainingHubSection(
                id: "core",
                title: "核心训练入口",
                subtitle: "Arena 与复习入口集中在这里。",
                entries: coreEntries
            ),
            TrainingHubSection(
                id: "skills",
                title: "技能训练",
                subtitle: "混合模式与听力入口。",
                entries: skillEntries
            )
        ]
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
}

struct TrainingHubAudioEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/audio"
    let method: HTTPMethod = .get
}

struct TrainingHubReviewCardsEndpoint: Endpoint {
    let path = "/api/mobile/v1/session/review-cards"
    let method: HTTPMethod = .get
}
