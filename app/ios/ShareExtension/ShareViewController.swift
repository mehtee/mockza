import UIKit
import Social
import UniformTypeIdentifiers

/// Edition-isolated iOS Share Extension (`group.com.mockza.app` for Mockza GLB vs `group.ir.sanjia.app` for Sanjia IRN).
/// Copies bounded shared URLs/text/images into the App Group container and deep-links into `/drop`.
final class ShareViewController: UIViewController {
  private let maxMediaBytes = 5 * 1024 * 1024

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    handleIncomingShareItems()
  }

  private func resolveAppGroupIdentifier() -> String {
    let bundleId = Bundle.main.bundleIdentifier ?? "com.mockza.app.ShareExtension"
    return bundleId.hasPrefix("ir.sanjia") ? "group.ir.sanjia.app" : "group.com.mockza.app"
  }

  private func resolveDeepLinkScheme() -> String {
    let bundleId = Bundle.main.bundleIdentifier ?? "com.mockza.app.ShareExtension"
    return bundleId.hasPrefix("ir.sanjia") ? "sanjia" : "mockza"
  }

  private func handleIncomingShareItems() {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let attachments = item.attachments else {
      extensionContext?.completeRequest(returningItems: nil)
      return
    }

    let groupId = resolveAppGroupIdentifier()
    let scheme = resolveDeepLinkScheme()
    let defaults = UserDefaults(suiteName: groupId)

    for provider in attachments.prefix(4) {
      if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { raw, _ in
          if let url = raw as? URL {
            defaults?.set(["kind": "url", "text": url.absoluteString], forKey: "pending_drop_payload")
            if let target = URL(string: "\(scheme)://drop?url=\(url.absoluteString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
              _ = self.openHostUrl(target)
            }
          }
          self.extensionContext?.completeRequest(returningItems: nil)
        }
        return
      }
      if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
        provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { raw, _ in
          if let text = raw as? String {
            let bounded = String(text.prefix(15000))
            defaults?.set(["kind": "text", "text": bounded, "mimeType": "text/plain"], forKey: "pending_drop_payload")
            if let encoded = bounded.prefix(2000).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
               let target = URL(string: "\(scheme)://drop?text=\(encoded)") {
              _ = self.openHostUrl(target)
            }
          }
          self.extensionContext?.completeRequest(returningItems: nil)
        }
        return
      }
      if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) ||
         provider.hasItemConformingToTypeIdentifier(UTType.audio.identifier) {
        let isAudio = provider.hasItemConformingToTypeIdentifier(UTType.audio.identifier)
        let typeId = isAudio ? UTType.audio.identifier : UTType.image.identifier
        let mimeHint = isAudio ? "audio/mp4" : "image/jpeg"
        let maxCount = isAudio ? 1 : 4
        let mediaProviders = attachments.filter { $0.hasItemConformingToTypeIdentifier(typeId) }.prefix(maxCount)
        let group = DispatchGroup()
        var stagedPaths: [String] = []
        let syncQueue = DispatchQueue(label: "mockza.share.stage")
        for mediaProvider in mediaProviders {
          group.enter()
          mediaProvider.loadItem(forTypeIdentifier: typeId, options: nil) { raw, _ in
            defer { group.leave() }
            if let srcUrl = raw as? URL,
               let containerUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) {
              let stagingDir = containerUrl.appendingPathComponent("drop_staging", isDirectory: true)
              try? FileManager.default.createDirectory(at: stagingDir, withIntermediateDirectories: true)
              let ext = srcUrl.pathExtension.isEmpty ? (isAudio ? "m4a" : "jpg") : srcUrl.pathExtension
              let destUrl = stagingDir.appendingPathComponent("\(UUID().uuidString).\(ext)")
              if let attrs = try? FileManager.default.attributesOfItem(atPath: srcUrl.path),
                 let fileSize = attrs[.size] as? NSNumber,
                 fileSize.intValue <= self.maxMediaBytes {
                try? FileManager.default.copyItem(at: srcUrl, to: destUrl)
                syncQueue.sync { stagedPaths.append(destUrl.path) }
              }
            }
          }
        }
        group.notify(queue: .main) {
          if !stagedPaths.isEmpty {
            defaults?.set([
              "kind": isAudio ? "audio" : "image",
              "files": stagedPaths,
              "mimeType": mimeHint,
            ], forKey: "pending_drop_payload")
            if let target = URL(string: "\(scheme)://drop") {
              _ = self.openHostUrl(target)
            }
          }
          self.extensionContext?.completeRequest(returningItems: nil)
        }
        return
      }
    }
    extensionContext?.completeRequest(returningItems: nil)
  }

  private func openHostUrl(_ url: URL) -> Bool {
    var responder: UIResponder? = self
    while let r = responder {
      if let application = r as? UIApplication {
        application.open(url, options: [:], completionHandler: nil)
        return true
      }
      responder = r.next
    }
    return false
  }
}
