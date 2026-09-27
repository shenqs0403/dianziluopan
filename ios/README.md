# iOS 工程（待建）

- 加载 `ios/www/index.html`（由 `cd web && npm run sync` 同步）。
- `WKUserContentController` 添加脚本消息处理器 `dianzhi`，与 `web/src/platform/ios.js` 对应。

## Swift 骨架

```swift
final class Bridge: NSObject, WKScriptMessageHandler {
    let webView: WKWebView
    init(webView: WKWebView) { self.webView = webView }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "startSensors": Motion.shared.start { self.send($0) }
        case "stopSensors":  Motion.shared.stop()
        case "setTheme":     UIApplication.shared.windows.first?.overrideUserInterfaceStyle =
                                ((body["payload"] as? Bool) == true ? .dark : .light)
        case "vibrate":      UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "keepScreenOn": UIApplication.shared.isIdleTimerDisabled = (body["payload"] as? Bool) ?? false
        default: break
        }
    }

    func send(_ s: [String: Any]) {
        let js = "window.__diZhiBridge.emit('sensor', \(jsonString(s)))"
        DispatchQueue.main.async { self.webView.evaluateJavaScript(js) }
    }
}

final class Motion {
    static let shared = Motion()
    private let mm = CMMotionManager()
    private var base: Double?

    func start(_ cb: @escaping ([String: Any]) -> Void) {
        mm.deviceMotionUpdateInterval = 1.0 / 30
        mm.startDeviceMotionUpdates(using: .xArbitraryCorrectedZVertical, to: .main) { m, _ in
            guard let m = m else { return }
            let az = Double(m.heading)              // 真北，顺时针
            if self.base == nil { self.base = az }
            let fixed = (az - (self.base ?? az)).truncatingRemainder(dividingBy: 360)
            cb(["azimuth": fixed < 0 ? fixed + 360 : fixed,
                "pitch": m.attitude.pitch * 180 / .pi,
                "roll": m.attitude.roll * 180 / .pi,
                "accuracy": m.headingAccuracy >= 0 ? 3 : 1])
        }
    }
    func stop() { mm.stopDeviceMotionUpdates() }
}
```

要点：iOS 13+ 若走 `DeviceOrientationEvent` 需授权，建议直接用原生 CoreMotion 推送（上面的实现）；
`m.heading` 已是真北，不需要再补磁偏角。
