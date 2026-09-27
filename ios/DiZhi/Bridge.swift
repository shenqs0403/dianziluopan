import UIKit
import WebKit

/// JS → 原生的唯一入口，对应 web/src/platform/ios.js 里的
/// `window.webkit.messageHandlers.dianzhi.postMessage({ type, payload })`。
///
/// 注意 iOS 侧的 getPrefs/setPrefs 由 JS 自己用 localStorage 实现，
/// 所以这里不需要这两个方法（与 Android 不同，见 web/src/platform/ios.js）。
final class Bridge: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?
    weak var window: UIWindow?

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? [String: Any],
              let type = body["type"] as? String else { return }
        let payload = body["payload"]

        switch type {
        case "startSensors":
            Motion.shared.start { [weak self] reading in self?.send(reading) }
        case "stopSensors":
            Motion.shared.stop()
        case "setTheme":
            let dark = (payload as? Bool) == true
            window?.overrideUserInterfaceStyle = dark ? .dark : .light
        case "vibrate":
            // JSONSerialization 出来的数字是 Double，但别只认 Double：
            // 万一上游塞的是 NSNumber 包装的 Int，也要能取到。
            let ms: Double
            if let d = payload as? Double {
                ms = d
            } else if let i = payload as? Int {
                ms = Double(i)
            } else {
                ms = 30
            }
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred(intensity: CGFloat(min(max(ms / 100, 0.4), 1.0)))
        case "keepScreenOn":
            UIApplication.shared.isIdleTimerDisabled = (payload as? Bool) ?? false
        default:
            break
        }
    }

    /// 原生 → JS，与 Android 端同一个入口：window.__diZhiBridge.emit(...)
    func send(_ sensor: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: sensor),
              let json = String(data: data, encoding: .utf8) else { return }
        emit(type: "sensor", json: json)
    }

    /// 生命周期事件，事件名与 Android 端一致（pause / resume / back）
    func emitEvent(_ name: String) {
        emit(type: "event", json: "{\"name\":\"\(name)\"}")
    }

    private func emit(type: String, json: String) {
        // 加 window.__diZhiBridge && 是为了页面还没加载完时不报错
        let js = "window.__diZhiBridge&&__diZhiBridge.emit('\(type)',\(json))"
        // Motion 的回调已在主线程；AppDelegate 的生命周期事件本来也在主线程，
        // 这里再兜一层，防止以后有人从别的线程调 emit
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

/// WKUserContentController 会强引用 message handler，
/// 直接把 Bridge 塞进去会形成 webView → controller → Bridge → webView 的环，
/// 退出页面时整棵 WebView 图都泄掉。用弱引用代理打断。
final class ScriptMessageProxy: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
