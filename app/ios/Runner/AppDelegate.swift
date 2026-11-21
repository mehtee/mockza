import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var audioSessionChannel: FlutterMethodChannel?
  private var shareIntentChannel: FlutterMethodChannel?

  private func resolveAppGroupIdentifier() -> String {
    let bundleId = Bundle.main.bundleIdentifier ?? "com.mockza.app"
    return bundleId.hasPrefix("ir.sanjia") ? "group.ir.sanjia.app" : "group.com.mockza.app"
  }

  private func consumeAppGroupSharePayload() -> [String: Any]? {
    let groupId = resolveAppGroupIdentifier()
    guard let defaults = UserDefaults(suiteName: groupId),
          let payload = defaults.dictionary(forKey: "pending_drop_payload") else {
      return nil
    }
    defaults.removeObject(forKey: "pending_drop_payload")
    return payload
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if url.host == "drop" || url.path.hasPrefix("/drop") {
      if let payload = consumeAppGroupSharePayload() {
        shareIntentChannel?.invokeMethod("onShareReceived", arguments: payload)
        return true
      }
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
      let urlParam = components?.queryItems?.first(where: { $0.name == "url" })?.value
      let textParam = components?.queryItems?.first(where: { $0.name == "text" })?.value
      if let shared = urlParam ?? textParam {
        shareIntentChannel?.invokeMethod("onShareReceived", arguments: [
          "text": shared,
          "mimeType": "text/plain",
        ])
        return true
      }
    }
    return super.application(app, open: url, options: options)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "MockzaAudioSession") {
      let channel = FlutterMethodChannel(
        name: "com.mockza/audio_session",
        binaryMessenger: registrar.messenger()
      )
      channel.setMethodCallHandler { call, result in
        switch call.method {
        case "configureRecordingSession":
          do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
              .playAndRecord,
              mode: .voiceChat,
              options: [.defaultToSpeaker, .allowBluetooth]
            )
            try session.setActive(true)
            result(nil)
          } catch {
            result(FlutterError(
              code: "AUDIO_SESSION_ERROR",
              message: error.localizedDescription,
              details: nil
            ))
          }
        case "openAppSettings":
          guard let url = URL(string: UIApplication.openSettingsURLString) else {
            result(false)
            return
          }
          DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(url) {
              UIApplication.shared.open(url, options: [:]) { success in
                result(success)
              }
            } else {
              result(false)
            }
          }
        default:
          result(FlutterMethodNotImplemented)
        }
      }
      self.audioSessionChannel = channel
    }

    if let shareRegistrar = engineBridge.pluginRegistry.registrar(forPlugin: "MockzaShareIntent") {
      let shareChannel = FlutterMethodChannel(
        name: "com.mockza.app/share_intent",
        binaryMessenger: shareRegistrar.messenger()
      )
      shareChannel.setMethodCallHandler { [weak self] call, result in
        switch call.method {
        case "consumeInitialShare":
          result(self?.consumeAppGroupSharePayload())
        default:
          result(FlutterMethodNotImplemented)
        }
      }
      self.shareIntentChannel = shareChannel
    }
  }
}
