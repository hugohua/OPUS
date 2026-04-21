import Foundation

enum RuntimeConfigError: LocalizedError, Equatable {
    case missingKey(String)
    case invalidValue(String, String)

    var errorDescription: String? {
        switch self {
        case .missingKey(let key):
            return "Missing runtime config key: \(key)"
        case .invalidValue(let key, let value):
            return "Invalid value '\(value)' for runtime config key \(key)"
        }
    }
}

struct RuntimeConfig: Equatable {
    static let environmentKey = "OPUSAppEnv"
    static let baseURLKey = "OPUSAPIBaseURL"
    static let networkLoggingKey = "OPUSEnableNetworkLogging"
    static let displayNameSuffixKey = "OPUSDisplayNameSuffix"
    static let allowInsecureLocalLoadsKey = "OPUSATSAllowInsecureLocal"

    let appEnvironment: AppEnvironment
    let apiBaseURL: URL
    let networkLoggingEnabled: Bool
    let displayNameSuffix: String
    let allowsInsecureLocalLoads: Bool

    init(
        appEnvironment: AppEnvironment,
        apiBaseURL: URL,
        networkLoggingEnabled: Bool,
        displayNameSuffix: String,
        allowsInsecureLocalLoads: Bool
    ) {
        self.appEnvironment = appEnvironment
        self.apiBaseURL = apiBaseURL
        self.networkLoggingEnabled = networkLoggingEnabled
        self.displayNameSuffix = displayNameSuffix
        self.allowsInsecureLocalLoads = allowsInsecureLocalLoads
    }

    init(infoDictionary: [String: Any]) throws {
        guard let rawEnvironment = Self.readString(Self.environmentKey, from: infoDictionary) else {
            throw RuntimeConfigError.missingKey(Self.environmentKey)
        }
        let normalizedEnvironment = rawEnvironment.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let appEnvironment = AppEnvironment(rawValue: normalizedEnvironment.lowercased()) else {
            throw RuntimeConfigError.invalidValue(Self.environmentKey, rawEnvironment)
        }

        guard let rawBaseURL = Self.readString(Self.baseURLKey, from: infoDictionary) else {
            throw RuntimeConfigError.missingKey(Self.baseURLKey)
        }
        let normalizedBaseURL = rawBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            let apiBaseURL = URL(string: normalizedBaseURL),
            let scheme = apiBaseURL.scheme,
            !scheme.isEmpty,
            apiBaseURL.host != nil
        else {
            throw RuntimeConfigError.invalidValue(Self.baseURLKey, rawBaseURL)
        }

        self.appEnvironment = appEnvironment
        self.apiBaseURL = apiBaseURL
        self.networkLoggingEnabled = try Self.readBool(Self.networkLoggingKey, from: infoDictionary)
        self.displayNameSuffix = Self.readString(Self.displayNameSuffixKey, from: infoDictionary) ?? ""
        self.allowsInsecureLocalLoads = try Self.readBool(Self.allowInsecureLocalLoadsKey, from: infoDictionary)
    }

    static func load(bundle: Bundle = .main) throws -> RuntimeConfig {
        try RuntimeConfig(infoDictionary: bundle.infoDictionary ?? [:])
    }

    static let fallbackLocal = RuntimeConfig(
        appEnvironment: .local,
        apiBaseURL: URL(string: "http://localhost:3000")!,
        networkLoggingEnabled: true,
        displayNameSuffix: " Local",
        allowsInsecureLocalLoads: true
    )

    private static func readString(_ key: String, from dictionary: [String: Any]) -> String? {
        if let value = dictionary[key] as? String {
            return value
        }
        if let value = dictionary[key] as? NSNumber {
            return value.stringValue
        }
        return nil
    }

    private static func readBool(_ key: String, from dictionary: [String: Any]) throws -> Bool {
        guard let value = dictionary[key] else {
            throw RuntimeConfigError.missingKey(key)
        }

        if let bool = value as? Bool {
            return bool
        }

        if let number = value as? NSNumber {
            return number.boolValue
        }

        if let rawString = value as? String {
            switch rawString.lowercased() {
            case "yes", "true", "1":
                return true
            case "no", "false", "0":
                return false
            default:
                throw RuntimeConfigError.invalidValue(key, rawString)
            }
        }

        throw RuntimeConfigError.invalidValue(key, String(describing: value))
    }
}
