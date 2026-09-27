# iOS 工程

WKWebView + Core Motion 的罗盘容器，界面复用 `web` 工程的构建产物。

## 生成与运行

```bash
# 1. 同步界面资源（web/dist → ios/www）
cd ../web && npm run sync -- ios

# 2. 生成 Xcode 工程
brew install xcodegen      # 只需一次
cd ../ios && xcodegen generate

# 3. 打开
open DiZhi.xcodeproj
```

`DiZhi.xcodeproj` 是生成物，不进版本库（`ios/.gitignore` 已排除）；
改工程结构请改 `project.yml`。理由见该文件顶部注释。

## 文件

| 文件 | 作用 |
| --- | --- |
| `project.yml` | XcodeGen 工程描述（target、bundle id、资源、依赖） |
| `DiZhi/AppDelegate.swift` | 传统 AppDelegate 生命周期；进后台停传感器并发 `pause` |
| `DiZhi/DialViewController.swift` | 全屏 WKWebView、注册 `dianzhi` 消息处理器、拦外跳 |
| `DiZhi/Bridge.swift` | JS→原生 5 个命令 + 原生→JS 的 `__diZhiBridge.emit` |
| `DiZhi/Motion.swift` | Core Motion 姿态 → 方位角/pitch/roll/accuracy |
| `DiZhi/Info.plist` | 定位用途说明、竖屏、隐藏状态栏 |
| `www/` | 由 `npm run sync -- ios` 同步，勿手改 |

## 桥接契约

JS 侧适配器是 `web/src/platform/ios.js`，**不要直接改**，
契约在 `web/src/platform/contract.js`，`npm run contract` 会校验。

- JS → 原生：`window.webkit.messageHandlers.dianzhi.postMessage({ type, payload })`
  - `type` 取值：`startSensors` / `stopSensors` / `setTheme` / `vibrate` / `keepScreenOn`
  - `Bridge.swift` 里每个 `type` 必须有一个 `case`，少一个就是静默失效
- 原生 → JS：`window.__diZhiBridge.emit('sensor', {...})` / `emit('event', {name})`
- `getPrefs` / `setPrefs` **不在桥里**：iOS 用 WKWebView 的 localStorage 实现

## 方位角来源：这里最容易写错

Core Motion 的参照系选错，指针会完全指错方向：

| 参照系 | X 轴指向 | 能否当罗盘 |
| --- | --- | --- |
| `xArbitraryCorrectedZVertical` | **任意**水平方向 | ❌ `yaw` 只是相对启动时的朝向 |
| `xMagneticNorthZVertical` | 磁北 | ✅ 无需定位权限 |
| `xTrueNorthZVertical` | 真北 | ✅ 最准，需定位服务可用（系统算磁偏角） |

`Motion.swift` 的做法是按 `availableAttitudeReferenceFrames()` 的实际可用集合，
依次取 真北 → 磁北 → 任意，并在 `accuracy` 里如实降级（3 / 2 / 1）。
Apple 文档明确要求罗盘类应用用 magnetic/true north 帧。

用 `attitude.yaw` 而非 `deviceMotion.heading`：Z-vertical 帧下两者等价，
但 `yaw` 在所有参照系下都有定义，回退到任意帧时不会变成无意义值。

## pitch / roll 口径

顶部水平仪的判据是 `|pitch| < 1.2 && |roll| < 1.2`（`TopBar.vue`），
所以要发「与竖直方向的夹角」而不是 Core Motion 的原始 pitch：

```
pitch = attitude.pitch * 180/π + 90   // 竖直持握时为 0
roll  = attitude.roll  * 180/π        // 左右倾为正
```

## 已知限制

- **本工程未在 CI 或本机编译过**：开发环境是 Linux，没有 Xcode。
  语法与契约只做了静态校验，首次 `xcodegen generate` + 真机运行仍需人工确认。
- WKWebView 以 `file://` 加载时 localStorage 在部分 iOS 版本上不可用；
  `ios.js` 里已 try/catch 兜底，最坏结果是「深色模式/已校准」不跨次启动保留。
  要彻底解决得换成自定义 scheme 或本地 HTTP，但当前没有这个必要。
- 图标、启动图还没做，`project.yml` 里也没写 `ASSETCATALOG`。
  上架前需要补 `Assets.xcassets`。
- 震动用的是 `UIImpactFeedbackGenerator`，不做定时长震动；
  契约里的 `vibrate(ms)` 只用作点按反馈。
