import Foundation

protocol VocabularyServing {
    func fetchList(page: Int, search: String, status: VocabularyStatus, sort: VocabularySort, tagFilter: String?) async throws -> VocabularyListPayload
    func fetchTags() async throws -> [String]
    func fetchDetail(id: Int) async throws -> VocabularyDetailPayload
}

struct VocabularyService: VocabularyServing {
    let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchList(page: Int, search: String, status: VocabularyStatus, sort: VocabularySort, tagFilter: String?) async throws -> VocabularyListPayload {
        let envelope = try await apiClient.send(
            VocabularyListEndpoint(page: page, search: search, status: status, sort: sort, tagFilter: tagFilter),
            as: MobileEnvelope<VocabularyListPayload>.self
        )
        return envelope.data
    }

    func fetchTags() async throws -> [String] {
        let envelope = try await apiClient.send(VocabularyTagsEndpoint(), as: MobileEnvelope<VocabularyTagsPayload>.self)
        return envelope.data.tags
    }

    func fetchDetail(id: Int) async throws -> VocabularyDetailPayload {
        let envelope = try await apiClient.send(VocabularyDetailEndpoint(id: id), as: MobileEnvelope<VocabularyDetailPayload>.self)
        return envelope.data
    }
}

struct VocabularyListEndpoint: Endpoint {
    let path = "/api/mobile/v1/vocab/list"
    let method: HTTPMethod = .get
    let page: Int
    let search: String
    let status: VocabularyStatus
    let sort: VocabularySort
    let tagFilter: String?

    var queryItems: [URLQueryItem] {
        var items = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "status", value: status.rawValue),
            URLQueryItem(name: "sort", value: sort.rawValue),
        ]

        if !search.isEmpty {
            items.append(URLQueryItem(name: "search", value: search))
        }
        if let tagFilter, !tagFilter.isEmpty {
            items.append(URLQueryItem(name: "tagFilter", value: tagFilter))
        }
        return items
    }
}

struct VocabularyTagsEndpoint: Endpoint {
    let path = "/api/mobile/v1/vocab/tags"
    let method: HTTPMethod = .get
}

struct VocabularyDetailEndpoint: Endpoint {
    let method: HTTPMethod = .get
    let id: Int
    var path: String { "/api/mobile/v1/vocab/\(id)" }
}
