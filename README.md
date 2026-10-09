# 电子罗盘（地之罗盘）

四个独立工程共用同一份 Vue 界面，陀螺仪由各自原生容器实现。

| 工程 | 目录 | 作用 | 状态 |
| --- | --- | --- | --- |
| Vue 界面 | `web/` | 唯一的界面实现，Canvas 画盘 | ✅ 已完成 |
| Android | `android/` | WebView 容器 + 陀螺仪（minSdk 24 / Android 7+） | ✅ 已完成，debug 包可安装 |
| iOS | `ios/` | WKWebView 容器 + CoreMotion 陀螺仪 | 🟡 工程已建，未编译验证 |
| 鸿蒙 | `harmony/` | ArkWeb 容器 + sensor 服务 | 🟡 工程已建，未编译验证 |
| 鸿蒙快应用 | `harmony/quickapp/` | 快应用 web-view 容器 | 🟡 骨架已建，传感器未实现 |

> iOS / 鸿蒙 / 快应用是在 **Linux** 上写的，本机没有 Xcode、DevEco Studio、
> 也没有快应用打包器，所以**三端都没有编译过，更没上过真机**。
> 已验证的只有：桥接方法名与 emit 出口一致（`npm run contract`）、
> 鸿蒙配置语法、以及 Android 端 18 项 E2E。详见各端 README 的「已知限制」。

## 界面规格

1. **首次运行提示**：只弹一次。点盘面任意位置（含内盘）即按该方位选定坐山与朝山，
   长按盘面可清空；电子罗盘仅供参考和学习使用，正式测量请使用真实罗盘。
2. **陀螺仪校对**：提示手持设备画「8」字，满足「累计行程 ≥ 360° 且方向反转 ≥ 2 次」后自动关闭，
   右上角可跳过；校准得到的零偏由 JS 统一补偿。
3. **罗盘界面**
   - 第一部分（12%）：三合 / 三元 / 综合 / 简易按钮组、主题切换按钮组、最右水平仪。
   - 第二部分（62%）：取 `min(屏宽-4, 屏高-4)` 的正方形（宽高比受限时按宽走），
     底色随主题走（亮色跟页面底一致、靠描边区分方块边界，暗色仍是深红）、
     红色天心十字线；天池占 5%。正方形是内盘已放大到极限，再放大就要改正方形本身。
     每圈文字按像素自适应，两字及以上竖排。
   - **内盘按住可拖拽旋转**，松手立即停。外圈角度圈属于内盘，**跟着一起转**，
     0°/180° 显示「北」「南」而不是数字。指针、实时方位线、天池十字线不随盘转。
   - 第三部分（26%）：左右严格等分两半（`grid 1fr 1fr`，用 flex 1 1 0 时右半的
     padding 会让外宽多 8px），各显示六项：度数、方向、坐山、朝山、吉凶、说明。
     - 左「选定方位」只跟点击有关：未点过时六项显示占位符「—」（不跟陀螺仪）；
       点盘面任意位置（内盘/圆周/方角）**一次**即定下方位 + 坐山 + 朝山
       （朝山取正对的山）；长按 600ms 清空（连选定方位一起清，回到占位符）。
     - 右「实时方位」＝蓝针（指北）在**当前盘面**上所指的度数（`azimuth-rotation`），
       坐山＝读数反方向（背后）、朝山＝读数方向（前方），吉凶按该方位现算，
       所以**点盘面不影响右半，转动内盘则右半跟着变**。
   - 传感器读数统一做低通平滑（时间常数 300ms，方位角跨 0/360 按最短弧插值），
     指针与水平仪不随手持微颤晃动。
   - 顶部右侧水平仪为**十字双气泡**：横管测左右倾斜、竖管测前后倾斜，各一颗气泡，
     气泡总是朝「抬起的一侧」跑，两泡同时居中即水平。

## 快速开始

```bash
cd web
npm install
npm run check          # 跨端契约校验 + 自检 + 构建 + 内联为单文件 index.html
npm run e2e            # 端到端交互测试（需 adb + 设备/模拟器，会自己装包并清数据）
npm run preview        # 打开 http://<本机IP>:5173/
npm run sync           # 同步 dist/index.html 到 android 的 assets/www
npm run sync -- ios harmony quickapp   # 需要时再同步其他端
```

`npm run contract` 是跨端桥接的守门检查：它会**真的执行**各端 JS 适配器，
用探针对象记录它们实际委派给原生的方法，再核对 Android / iOS / 鸿蒙 / 快应用
的原生源码是否真的实现了这些方法。改 `web/src/platform/*.js` 或原生方法名后
一定要跑，否则漏实现只会表现为「界面某功能静默失效」。

```bash
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`npm run smoke` 用假 ctx 断言绘制调用，不需要浏览器；`npm run e2e` 则跑在真机/模拟器的
WebView 里，点真按钮、读真像素。App 已手动起好时可用 `node scripts/e2e.mjs --no-device` 跳过装包。

当前**只有 Android 端确认可用**（`npm run e2e` 18/18 通过）。
iOS、鸿蒙、快应用三端的工程已建好，但都在 Linux 上写的、**未编译未上真机**。

- `ios/README.md`：生成工程步骤、方位角参照系的选择依据、已知限制
- `harmony/README.md`：现代 sensor API 写法（不要再用 `createSensor`）、权限、已知限制
- `harmony/quickapp/README.md`：快应用现状与待补的传感器实现
- `web/src/platform/contract.js`：四端共用的桥接契约
- `android/README.md`：Android 端细节
