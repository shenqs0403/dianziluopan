import UIKit

/// 只用 AppDelegate 的传统生命周期，不引入 Scene。
/// 少一层 scene 转发，传感器/前后台事件的因果关系一眼看得懂，
/// 而这套生命周期到 iOS 18 仍然完全支持。
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var dial: DialViewController?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let vc = DialViewController()
        dial = vc

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = vc
        // 界面自带深色配色，锁深色避免浅色状态栏配深色底看不清
        window.overrideUserInterfaceStyle = .dark
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        dial?.bridge.emitEvent("resume")
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // 进后台立刻停传感器，跟 Android 的 onPause 一致，别在后台空转耗电
        Motion.shared.stop()
        dial?.bridge.emitEvent("pause")
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Motion.shared.stop()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        Motion.shared.stop()
    }
}
