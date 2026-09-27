# 鸿蒙工程

ArkTS + ArkUI Web（ArkWeb）罗盘容器，界面复用 `web` 工程的构建产物。
另含 `quickapp/`（鸿蒙快应用）。

## 同步界面资源

```bash
cd ../web && npm run sync -- harmony quickapp
```

- ArkTS → `harmony/entry/src/main/resources/rawfile/www`（`$rawfile('www/index.html')`）
- 快应用 → `harmony/quickapp/src/www`

## 打开与运行

用 DevEco Studio 打开 `harmony` 目录，等待 `ohpm install` 完成同步依赖，
然后直接 Run `entry`。命令行构建为 `hvigorw assembleHap`（需 DevEco 提供的 hvigor）。

## 目录

```
harmony/
├── AppScope/app.json5                  bundleName = com.linglongopc.dianziluopan
├── build-profile.json5                 products / modules
├── hvigorfile.ts
├── oh-package.json5
├── entry/
│   ├── src/main/module.json5           权限、Ability、竖屏
│   └── src/main/
│       ├── ets/entryability/EntryAbility.ets
│       ├── ets/pages/Index.ets         Web 组件 + javaScriptProxy
│       ├── ets/common/DiZhiNative.ets  window.DiZhiNative 实现
│       ├── ets/common/SensorBus.ets    传感器订阅
│       └── resources/rawfile/www/      同步产物，勿手改
└── quickapp/                           鸿蒙快应用
```

## 传感器 API：不要用 README 里的旧写法

旧文档里的 `sensor.createSensor()` / `sensor.stop()` / `{ frequency: 30 }`
已经废弃。现代写法：

```ts
import { sensor } from '@kit.SensorServiceKit'

sensor.on(sensor.SensorId.ORIENTATION, (data: sensor.OrientationResponse) => {
  const yaw = data.alpha * 180 / Math.PI   // 绕 Z 轴偏航，弧度
}, { interval: { type: sensor.IntervalType.NORMAL, value: 100_000_000 } })

sensor.off(sensor.SensorId.ORIENTATION)    // 必须按 sensorId 取消
```

坑点：

- `interval` 单位是**纳秒**，`100_000_000` ≈ 30Hz。不要写 `frequency`。
- 用 `ORIENTATION`（明确是 `alpha/beta/gamma`）而不是 `ROTATION_VECTOR`
  （响应结构随 SDK 版本变化）。两者都是磁力计融合结果。
- 所以上报的 `accuracy` 是 **2（磁北）**，不是 3（真北）——
  传感器链路拿不到磁偏角，别假装对齐了真北。

## 权限

`module.json5` 里只申请了 `ohos.permission.VIBRATE`。

`ORIENTATION` / `ROTATION_VECTOR` 属系统基础传感器，**不需要**申请权限。
将来若加加速度计回退，才需要 `ohos.permission.ACCELEROMETER`
（`user_grant`，还要配 `reason` + `usedScene` 并在运行时申请）。

## 桥接契约

契约在 `web/src/platform/contract.js`，`npm run contract` 会校验。

- 注入对象名 `window.DiZhiNative`，由 ArkUI 的 `javaScriptProxy` 注册。
  **白名单机制**：`methodList` 里没有的方法，JS 侧拿到 `undefined`。
  改方法必须同时改 `DiZhiNative.methodList()`。
- 原生 → JS：`controller.runJavaScript("window.__diZhiBridge&&__diZhiBridge.emit('sensor',{...})")`
- `getPrefs()` **必须同步**：`platform/index.js` 的 `loadPrefs()` 拿到返回值
  立刻 `JSON.parse`，返回 Promise 会让所有配置退回默认值。
  `preferences` 是异步的，所以在 `DiZhiNative.prepare()` 里预热进内存缓存，
  `Index.ets` 等 `prepare()` 完成才挂 Web 组件来避开竞态。
- `__platform` 标记：ArkUI 白名单不暴露普通属性，所以 `detect()` 读不到
  `native.__platform`，在 `onControllerAttached` 里用 `runJavaScript` 补写。
  否则平台判断会退化成猜 UA。

## 已知限制（未在本机验证）

- **本工程没有编译过**：开发环境是 Linux，没有 DevEco Studio / hvigor。
  `npm run contract` 只校验了桥接方法名、emit 出口、`__platform` 标记，
  以及 6 个 `.json` + 6 个 `.json5` 的语法；ArkTS 的类型/导入正确性未验证。
- **beta 的 ±90 偏置需要真机确认一次**：`ORIENTATION` 的 beta/gamma 正负约定
  各家 ROM 不完全一致。若顶栏「水平」提示方向反了，把 `SensorBus.ets` 里
  `pitch` 的 `+ 90` 改成 `- 90`。
- **震动接口形态可能随 SDK 变动**：`vibrator.startVibration` 的参数在
  API 12+ 有调整。当前已 try/catch 兜底，失败只是没有点按反馈，不会崩。
- **runJavaScript 的线程**：`sensor` 回调不在 UI 线程，代码里直接调了
  `runJavaScript`（ArkWeb 内部会转交 web 线程）。真机若有异常，改法见
  `DiZhiNative.ets` 里 `push()` 的注释。
- 图标没做，`app.json5` 故意不写 `icon`（写了 `$media:xxx` 而文件不存在会直接编译失败）。
- 状态栏沉浸式没做；`EntryAbility` 里只做了常亮。

## 快应用

见 `quickapp/README.md`。
