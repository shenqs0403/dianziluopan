# 电子罗盘 · Vue 界面工程

四端（Android / iOS / 鸿蒙 / 鸿蒙快应用）共用的唯一界面工程，原生工程只负责容器与陀螺仪。

## 运行

```bash
npm install
npm run dev        # 开发调试，浏览器可直接看（浏览器走 DeviceOrientation 兜底）
npm run build      # 产出 dist/
npm run preview    # 预览 dist（已启动在 http://<本机IP>:5173/）
npm run sync       # 把 dist/ 同步到 ../android、../ios、../harmony 的资源目录
npm run smoke      # 无浏览器自检：四种盘的分层数据、绘制调用、判读结果
```

## 目录

```
src/
├── main.js / App.vue          界面骨架：8% 顶栏 + 70% 盘面 + 20% 底栏
├── components/
│   ├── TopBar.vue             类型按钮组、主题切换、右侧水平仪
│   ├── DialCanvas.vue         正方形盘面、天池十字线、拖拽旋转、轻点放山
│   ├── BottomBar.vue          当前方位吉凶、坐山/朝山与判读
│   ├── FirstRunNotice.vue     首次运行提示
│   └── CalibrateOverlay.vue   陀螺仪「8」字校对遮罩
├── composables/
│   ├── useSensors.js          方位角/俯仰/横滚订阅（原生推送或浏览器事件）
│   └── useCalibration.js      「8」字校对状态机（累计行程 + 方向反转次数）
├── dial/
│   ├── mountains.js           二十四山、纳甲、三合局、阴阳龙
│   ├── tables.js              洛书、纳音、穿山、宿度、十二长生、三元龙、黄泉…
│   ├── layers.js              三合/三元/综合/简易 四种盘的分层定义
│   ├── fortune.js             三合/三元/简易 判读 + 随方位吉凶
│   └── draw.js                Canvas 绘制与命中角度换算
└── platform/
    ├── contract.js            ★ 原生接口契约（改这里四端一起生效）
    ├── index.js               平台探测与统一入口
    ├── android.js ios.js harmony.js quickapp.js web.js
```

## 陀螺仪 / 系统能力接口契约

原生容器统一注入 `window.DiZhiNative`，并通过 `window.__diZhiBridge.emit(...)` 回传数据。
**JS 只认这两个名字，四端实现方式不同但接口完全一致。**

JS → 原生（方法名固定）：

| 方法 | 说明 |
| --- | --- |
| `startSensors()` / `stopSensors()` | 开始 / 停止传感器推送 |
| `setTheme(dark: boolean)` | 同步原生状态栏、背景色 |
| `vibrate(ms: number)` | 震动反馈 |
| `keepScreenOn(flag: boolean)` | 常亮 |
| `getPrefs(): string \| null` | 读本地配置（JSON 字符串） |
| `setPrefs(json: string)` | 写本地配置 |
| `close()` | 退出（可选） |

原生 → JS（唯一入口）：

```js
window.__diZhiBridge.emit('sensor', {
  azimuth: 137.6,   // 方位角，0=正北，顺时针增大，0~360，必须已补偿磁偏角
  pitch: 12.3,      // 俯仰 -180~180，抬头为正
  roll: -4.5,       // 横滚 -90~90
  accuracy: 3,      // 0~3，对齐真北为 3
  drift: 1.2,       // 陀螺仪零偏（度），JS 侧会自行补偿
  timestamp: 1730000000000
})

window.__diZhiBridge.emit('event', { name: 'back' })   // back | pause | resume
```

浏览器兜底（仅开发预览）：`DeviceOrientationEvent` / `DeviceMotionEvent`，
iOS 13+ 在用户手势内调用 `DeviceOrientationEvent.requestPermission()`。

## 三处可按需替换的地方

1. `src/dial/layers.js` —— 增删环层、改分格数。
2. `src/dial/tables.js` —— 换传统表（三元龙 72 排布、二十八宿吉凶等）。
3. `src/dial/fortune.js` —— 改判读口径（当前三合按「同局同阴阳 + 十二长生八格」、
   三元按「60 分阳顺阴逆」、综合取两法折中、简易只看同局与库位）。
