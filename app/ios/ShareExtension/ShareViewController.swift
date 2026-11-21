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
            defaults?.set(["kind": "text", "text": bounded], forKey: "pending_drop_payload")
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
