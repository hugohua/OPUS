import Foundation
import Observation

@MainActor
@Observable
final class VocabularyViewModel {
    var contentState: OpusContentState = .loading
    var items: [VocabularyListItem] = []
    var stats: VocabularyStats?
    var searchText = ""
    var selectedStatus: VocabularyStatus = .all
    var selectedSort: VocabularySort = .rank
    var selectedTag: String?
    var tags: [String] = []
    var currentPage = 1
    var hasMore = false
    var selectedDetail: VocabularyDetailPayload?
    var isLoadingDetail = false

    @ObservationIgnored private let service: VocabularyServing

    init(service: VocabularyServing) {
        self.service = service
    }

    func load(force: Bool = false) async {
        if !force, !items.isEmpty { return }
        contentState = .loading
        currentPage = 1

        do {
            async let tagValues = service.fetchTags()
            let list = try await service.fetchList(
                page: currentPage,
                search: searchText,
                status: selectedStatus,
                sort: selectedSort,
                tagFilter: selectedTag
            )

            tags = (try? await tagValues) ?? []
            applyList(list, reset: true)
        } catch {
            contentState = .error(
                title: "词库加载失败",
                message: "列表或标签暂时不可用，请稍后重试。",
                actionTitle: "重试"
            )
        }
    }

    func reloadFilters() async {
        await load(force: true)
    }

    func applyPendingStatus(_ status: VocabularyStatus) async {
        guard selectedStatus != status else {
            await load(force: true)
            return
        }

        selectedStatus = status
        await reloadFilters()
    }

    func loadNextPageIfNeeded(currentItem item: VocabularyListItem) async {
        guard hasMore, item.id == items.last?.id else { return }

        do {
            currentPage += 1
            let list = try await service.fetchList(
                page: currentPage,
                search: searchText,
                status: selectedStatus,
                sort: selectedSort,
                tagFilter: selectedTag
            )
            applyList(list, reset: false)
        } catch {
            currentPage -= 1
        }
    }

    func loadDetail(id: Int) async {
        isLoadingDetail = true
        defer { isLoadingDetail = false }

        do {
            selectedDetail = try await service.fetchDetail(id: id)
        } catch {
            selectedDetail = nil
        }
    }

    private func applyList(_ payload: VocabularyListPayload, reset: Bool) {
        stats = payload.metadata.stats
        hasMore = payload.metadata.hasMore
        items = reset ? payload.items : items + payload.items
        contentState = items.isEmpty
            ? .empty(
                title: "没有匹配的词条",
                message: "请调整搜索词或筛选条件。"
            )
            : .empty(title: "", message: "")
    }

    func resetForSessionChange() {
        contentState = .loading
        items = []
        stats = nil
        searchText = ""
        selectedStatus = .all
        selectedSort = .rank
        selectedTag = nil
        tags = []
        currentPage = 1
        hasMore = false
        selectedDetail = nil
        isLoadingDetail = false
    }
}
