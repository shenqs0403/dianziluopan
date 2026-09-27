# 鸿蒙快应用

快应用容器，界面复用同一份 `web` 构建产物。

```bash
cd ../../web && npm run sync -- quickapp   # → harmony/quickapp/src/www
```

## 目录

```
quickapp/
├── manifest.json          package = com.linglongopc.dianziluopan、features、router
├── package.json
└── src/
    ├── app.ux
    ├── common/bridge.ux   注入 window.DiZhiNative
    └── pages/index/index.ux   <web-view> 承载界面
```

## 桥接契约

与 `web/src/platform/quickapp.js` 对齐，命名不能变：

- JS → 原生：`window.DiZhiNative.startSensors()` 等 7 个方法
  （`getPrefs` / `setPrefs` 同样**必须同步**）
- 原生 → JS：`window.__diZhiBridge.emit('sensor', {...})`
- `bridge.ux` 里 `markPlatform()` 给 `window.DiZhiNative.__platform` 打
  `'quickapp'`，让 `platform/index.js` 的 `detect()` 不靠猜 UA

## 已知限制（未在本机验证，风险高于其它两端）

- **本工程没有编译、也没有真机跑过**。开发环境是 Linux，没有快应用打包器
  也没有设备，`manifest.json` 里的 `features`、`minPlatformVersion`、
  `<web-view>` 组件是否被目标快应用运行时支持，都**没有验证**。
- `common/bridge.ux` 里的 `bridge.*`（如 `bridge.startSensors()`）目前是
  抽象占位：具体订阅哪个传感器、走哪个模块，需要按目标快应用运行时的
  `@system.sensor` 文档补齐。这部分**没有真实实现**。
- 快应用的 web-view 与外层 `.ux` 不是同一个 `window`，所以平台标记、
  emit 出口都必须在注入的那份脚本里操作，不能从外层 `.ux` 直接摸。
- 震动、常亮、存储在 `manifest.json` 里声明了对应 feature，
  但具体 API 形态同样待确认。
- 如果目标运行时不支持内嵌 web-view，这一端应改为快应用原生重写界面，
  而不是继续修这套桥接。
