# 电子罗盘（地之罗盘）

四个独立工程共用同一份 Vue 界面，陀螺仪由各自原生容器实现。

| 工程 | 目录 | 作用 | 状态 |
| --- | --- | --- | --- |
| Vue 界面 | `web/` | 唯一的界面实现，Canvas 画盘 | ✅ 已完成 |
| Android | `android/` | WebView 容器 + 陀螺仪（minSdk 24 / Android 7+） | ✅ 已完成，debug 包可安装 |
| iOS | `ios/` | WKWebView 容器 + CoreMotion 陀螺仪 | 接口已留，待建工程 |
| 鸿蒙 / 鸿蒙快应用 | `harmony/` | ArkWeb / 快应用容器 + sensor 服务 | 接口已留，待建工程 |

## 界面规格

1. **首次运行提示**：电子罗盘仅供参考和学习使用，正式测量请使用真实罗盘。
2. **陀螺仪校对**：提示手持设备画「8」字，满足「累计行程 ≥ 360° 且方向反转 ≥ 2 次」后自动关闭，
   右上角可跳过；校准得到的零偏由 JS 统一补偿。
3. **罗盘界面**
   - 第一部分（8%）：三合 / 三元 / 综合 / 简易按钮组、主题切换按钮组、最右水平仪。
   - 第二部分（70%）：屏幕宽度减 4px 的正方形、黑红底、红色天心十字线；天池宽 5%，
     盘面不随手机旋转、指针随方位角转动；内盘占 90%、边距 5%；每圈文字按像素自适应，
     两字及以上竖排；盘面按住拖拽按方向旋转，松手立即停。
   - 第三部分（20%）：当前方位与吉凶；轻点盘面放坐山、再点放朝山，并给出一条判读。

## 快速开始

```bash
cd web
npm install
npm run check          # 自检 + 构建 + 内联为单文件 index.html
npm run preview        # 打开 http://<本机IP>:5173/
npm run sync           # 同步 dist/index.html 到 android 的 assets/www
npm run sync -- ios harmony   # 需要时再同步其他端
```

```bash
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

当前只有 Android 端可用；`ios/README.md`、`harmony/README.md` 仍是待实现的接口说明。
各端接入细节见 `web/README.md` 与 `android/README.md`。
