import Foundation

struct AuthEnvironmentStore {
    private let userDefaults: UserDefaults
    private let key: String

    init(
        userDefaults: UserDefaults = .standard,
        key: String = "com.hugo.opus.ios.auth.environment.base-url"
    ) {
        self.userDefaults = userDefaults
        self.key = key
    }

    func fetchBaseURL() -> URL? {
        guard let rawValue = userDefaults.string(forKey: key) else {
            return nil
        }

        return URL(string: rawValue)
    }

    func saveBaseURL(_ url: URL) {
        userDefaults.set(url.absoluteString, forKey: key)
    }

    func clearBaseURL() {
        userDefaults.removeObject(forKey: key)
    }
}
