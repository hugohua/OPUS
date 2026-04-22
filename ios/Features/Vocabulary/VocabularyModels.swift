import Foundation

enum VocabularyStatus: String, CaseIterable, Identifiable {
    case all = "ALL"
    case new = "NEW"
    case learning = "LEARNING"
    case review = "REVIEW"
    case mastered = "MASTERED"
    case leech = "LEECH"
    case context = "CONTEXT"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "全部"
        case .new: return "新词"
        case .learning: return "学习中"
        case .review: return "待复习"
        case .mastered: return "已掌握"
        case .leech: return "难点词"
        case .context: return "AI 情境"
        }
    }
}

enum VocabularySort: String, CaseIterable, Identifiable {
    case rank = "RANK"

    var id: String { rawValue }
    var title: String { "词频" }
}

struct VocabularyListPayload: Decodable {
    let items: [VocabularyListItem]
    let metadata: VocabularyListMetadata
}

struct VocabularyListItem: Decodable, Equatable, Identifiable {
    let id: Int
    let word: String
    let phonetic: String?
    let definition: String?
    let abceedRank: Int?
    let fsrs: VocabularyFSRS
}

struct VocabularyFSRS: Decodable, Equatable {
    let status: String
    let stability: Double
    let difficulty: Double
    let retention: Double
    let nextReview: String?
    let lapses: Int
    let isLeech: Bool
    let hasContext: Bool
    let contextSentence: String?
}

struct VocabularyListMetadata: Decodable, Equatable {
    let total: Int
    let page: Int
    let totalPages: Int
    let hasMore: Bool
    let stats: VocabularyStats
}

struct VocabularyStats: Decodable, Equatable {
    let mastered: Int
    let learning: Int
    let due: Int
    let totalVocab: Int
}

struct VocabularyTagsPayload: Decodable, Equatable {
    let tags: [String]
}

struct VocabularyDetailPayload: Decodable, Equatable {
    let vocab: VocabularyDetail
    let userTags: [String]
    let userNote: String
}

struct VocabularyDetail: Decodable, Equatable {
    let id: Int
    let word: String
    let phoneticUs: String?
    let phoneticUk: String?
    let definition_cn: String?
    let definition_jp: String?
    let partOfSpeech: String?
}
