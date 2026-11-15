import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var audioSessionChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
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
  }
}
