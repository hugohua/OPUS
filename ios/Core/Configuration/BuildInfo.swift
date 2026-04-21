import Foundation
import UIKit

struct BuildInfo: Equatable {
    let displayName: String
    let bundleIdentifier: String
    let appVersion: String
    let buildNumber: String
    let deviceName: String
    let systemVersion: String

    static func current(bundle: Bundle = .main, device: UIDevice = .current) -> BuildInfo {
        let info = bundle.infoDictionary ?? [:]
        let displayName = (info["CFBundleDisplayName"] as? String)
            ?? (info["CFBundleName"] as? String)
            ?? "Opus"
        let bundleIdentifier = bundle.bundleIdentifier ?? "unknown"
        let appVersion = (info["CFBundleShortVersionString"] as? String) ?? "0.0.0"
        let buildNumber = (info["CFBundleVersion"] as? String) ?? "0"

        return BuildInfo(
            displayName: displayName,
            bundleIdentifier: bundleIdentifier,
            appVersion: appVersion,
            buildNumber: buildNumber,
            deviceName: device.model,
            systemVersion: device.systemVersion
        )
    }
}
