# 电子罗盘（地之罗盘）

四个独立工程共用同一份 Vue 界面，陀螺仪由各自原生容器实现。

| 工程 | 目录 | 作用 | 状态 |
| --- | --- | --- | --- |
| Vue 界面 | `web/` | 唯一的界面实现，Canvas 画盘 | ✅ 已完成 |
| Android | `android/` | WebView 容器 + 陀螺仪（minSdk 24 / Android 7+） | ✅ 已完成，debug 包可安装 |
| iOS | `ios/` | WKWebView 容器 + CoreMotion 陀螺仪 | 接口已留，待建工程 |
| 鸿蒙 / 鸿蒙快应用 | `harmony/` | ArkWeb / 快应用容器 + sensor 服务 | 接口已留，待建工程 |

## 界面规格

1. **首次运行提示**：只弹一次。点盘面任意位置（含内盘）即按该方位选定坐山与朝山，
   长按盘面可清空；电子罗盘仅供参考和学习使用，正式测量请使用真实罗盘。
2. **陀螺仪校对**：提示手持设备画「8」字，满足「累计行程 ≥ 360° 且方向反转 ≥ 2 次」后自动关闭，
   右上角可跳过；校准得到的零偏由 JS 统一补偿。
3. **罗盘界面**
   - 第一部分（12%）：三合 / 三元 / 综合 / 简易按钮组、主题切换按钮组、最右水平仪。
   - 第二部分（62%）：取 `min(屏宽-4, 屏高-4)` 的正方形（宽高比受限时按宽走），
     黑红底、红色天心十字线；天池占 5%。正方形是内盘已放大到极限，再放大就要改正方形本身。
     每圈文字按像素自适应，两字及以上竖排。
   - **内盘按住可拖拽旋转**，松手立即停。外圈角度圈属于内盘，**跟着一起转**，
     0°/180° 显示「北」「南」而不是数字。指针、实时方位线、天池十字线不随盘转。
   - 第三部分（26%）：左右严格等分两半（`grid 1fr 1fr`，用 flex 1 1 0 时右半的
     padding 会让外宽多 8px），各显示六项：度数、方向、坐山、朝山、吉凶、说明。
     - 左「选定方位」只跟点击有关：点盘面任意位置（内盘/圆周/方角）**一次**即定下
       方位 + 坐山 + 朝山（朝山取正对的山）；长按 600ms 清空；点过之前跟随陀螺仪。
     - 右「陀螺仪南向」＝红针在**当前盘面**上所指的度数（`azimuth+180-rotation`），
       坐山朝山吉凶都按它自己的方位现算，所以**点盘面不影响右半，转动内盘则右半跟着变**。

## 快速开始

```bash
cd web
npm install
npm run check          # 自检 + 构建 + 内联为单文件 index.html
npm run e2e            # 端到端交互测试（需 adb + 设备/模拟器，会自己装包并清数据）
npm run preview        # 打开 http://<本机IP>:5173/
npm run sync           # 同步 dist/index.html 到 android 的 assets/www
npm run sync -- ios harmony   # 需要时再同步其他端
```

```bash
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`npm run smoke` 用假 ctx 断言绘制调用，不需要浏览器；`npm run e2e` 则跑在真机/模拟器的
WebView 里，点真按钮、读真像素。App 已手动起好时可用 `node scripts/e2e.mjs --no-device` 跳过装包。

当前只有 Android 端可用；`ios/README.md`、`harmony/README.md` 仍是待实现的接口说明。
各端接入细节见 `web/README.md` 与 `android/README.md`。
