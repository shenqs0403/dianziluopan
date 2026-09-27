# Android 工程

WebView 容器：加载 `web/` 构建出的单文件界面，注入 `DiZhiNative` 并按契约推送传感器。

- `minSdk 24`（Android 7.0）、`targetSdk 36`、锁定竖屏、沉浸式全屏。
- 无 AndroidX 依赖，直接用 `android.app.Activity` + `WebView`。
- 产物为单文件 `app/src/main/assets/www/index.html`，由 `cd ../web && npm run sync` 同步。

## 结构

```
app/src/main/
  AndroidManifest.xml
  assets/www/index.html        # 由 web 构建同步进来，不要手改
  java/com/linglongopc/dianziluopan/
    MainActivity.kt            # 全屏 WebView + 传感器解算
    DiZhiNative.kt             # window.DiZhiNative 的原生实现
  res/                         # 主题、图标、字符串
tools/make-icons.py            # 按各密度生成启动图标
```

## 构建

```bash
cd ../web && npm install && npm run check   # 自检 + 构建 + 内联
npm run sync                                 # 同步 dist/index.html 到 assets/www
cd ../android && ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- JDK 25、Gradle 9.7.1、AGP 9.1.0。
- AGP 9 已内置 Kotlin，**不要**再应用 `org.jetbrains.kotlin.android`，否则构建失败。
- `local.properties` 里的 `sdk.dir` 是本机路径，已被 `.gitignore` 忽略。
- 目前只产出 debug 包，未配置发布签名。

## 桥接口

JS 调 `window.DiZhiNative`：

| 方法 | 说明 |
| --- | --- |
| `startSensors()` / `stopSensors()` | 开关传感器监听 |
| `setTheme(dark)` | 切深浅色 |
| `vibrate(ms)` | 触感反馈 |
| `keepScreenOn(flag)` | 常亮 |
| `getPrefs()` / `setPrefs(json)` | `SharedPreferences` 持久化 |
| `close()` | 关闭界面 |

原生推 `window.__diZhiBridge.emit('sensor', {...})`：

```js
{ azimuth: 359.98, pitch: 94.7, roll: -0.02, accuracy: 3, drift: 0, timestamp: 1790488712463 }
```

另外还有 `emit('event', { name: 'resume' | 'pause' | 'back' })` 供页面感知生命周期。

## 传感器实现要点

- 姿态优先 `TYPE_ROTATION_VECTOR`，不可用时回退 `TYPE_GAME_ROTATION_VECTOR`，
  再不行用加速度计 + 磁力计自行积分。旋转矢量融合了陀螺仪和磁力计，比单用陀螺仪稳。
- 竖屏下用 `remapCoordinateSystem` 交换 X/Z 轴，适配手机自然握持方向。
- `azimuth` 用「首帧作基准」消除 0/360 跳变；`deg360()` 保证四舍五入后不会输出 360。
- `accuracy` 固定传 3，表示方位可用。只有在**已有**粗略位置权限时才叠加磁偏角，
  不主动弹权限框；没有权限就按磁北显示。
- `pitch` 取 `orientation[1] + 90`（相对垂直面的倾角），`roll` 限制在 ±90°。
- 推流约 30Hz，节流到每帧一次，页面侧再用 `requestAnimationFrame` 合帧。

## 已知限制

- 无真实设备验证过磁偏角、陀螺仪零偏和水平仪正负方向，模拟器上传感器读数基本恒定。
- 只在 `Small_Phone`（720×1280、density 320）上验证过布局。
