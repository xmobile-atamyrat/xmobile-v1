import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 1. Configure Firebase first (reads GoogleService-Info.plist)
    FirebaseApp.configure()

    // 2. Set UNUserNotificationCenter delegate so we can handle foreground notifications
    UNUserNotificationCenter.current().delegate = self

    // 3. Set FCM messaging delegate so onTokenRefresh fires natively
    Messaging.messaging().delegate = self

    // 4. Register with APNs — the FCM SDK will swap the APNs token for an FCM token automatically
    application.registerForRemoteNotifications()

    // 5. Boot React Native
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "mobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }


  // Called when APNs registration fails (simulator, provisioning issues, etc.)
  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    print("[FCM] Failed to register for remote notifications: \(error.localizedDescription)")
  }
}

// MARK: - UNUserNotificationCenterDelegate
// Enables foreground notification display; the JS layer (onMessage) handles the banner UI,
// so we suppress the native system alert in the foreground to avoid double-showing.
extension AppDelegate: UNUserNotificationCenterDelegate {
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Suppress native system banner — our React Native banner handles foreground display
    completionHandler([])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }
}

// MARK: - MessagingDelegate
// Receives the FCM registration token whenever it is refreshed by the SDK.
// @react-native-firebase/messaging also listens internally; this delegate
// simply provides a native-side log for debugging.
extension AppDelegate: MessagingDelegate {
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmRegistrationToken: String?) {
    guard let token = fcmRegistrationToken else { return }
    print("[FCM] Registration token refreshed: \(token)")
    // No manual posting needed — @react-native-firebase/messaging handles JS-side via onTokenRefresh()
  }
}

// MARK: - ReactNativeDelegate
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
