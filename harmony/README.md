# 鸿蒙 / 鸿蒙快应用工程（待建）

- 鸿蒙：ArkWeb `Web({ src: $rawfile('www/index.html'), javaScriptAccess: true })`，
  用 `webview.javaScriptProxy` 注册 `DiZhiNative`，与 `web/src/platform/harmony.js` 对应。
- 鸿蒙快应用：内嵌 webview 同样注入 `DiZhiNative`，与 `web/src/platform/quickapp.js` 对应
  （两个适配器除 platform 标识外方法名一致，业务代码不用改）。

## ArkTS 骨架（鸿蒙）

```ts
import sensor from '@ohos.sensor'
import promptAction from '@ohos.promptAction'

class DiZhiNative {
  startSensors(): void { SensorBus.start() }
  stopSensors(): void  { SensorBus.stop() }
  setTheme(dark: boolean): void { /* 同步状态栏 */ }
  vibrate(ms: number): void { promptAction.showToast({ message: '' }) }
  keepScreenOn(flag: boolean): void { /* window.setWindowKeepScreenOn */ }
  getPrefs(): string | null { return AppStorage.get('diZhiPrefs') ?? null }
  setPrefs(json: string): void { AppStorage.set('diZhiPrefs', json) }
}

class SensorBus {
  private static base: number | null = null
  static start() {
    sensor.createSensor(sensor.SensorId.ROTATION, (data: sensor.SensorData) => {
      const angle = (data.angleZ * 180) / Math.PI     // 顺时针，自正北
      if (SensorBus.base === null) SensorBus.base = angle
      const azimuth = ((angle - SensorBus.base) % 360 + 360) % 360
      webviewController.runJavaScript(
        `window.__diZhiBridge.emit('sensor',{azimuth:${azimuth},pitch:0,roll:0,accuracy:3})`)
    }, { frequency: 30, coordinateSystem: sensor.CoordinateSystem.DEVICE })
  }
  static stop() { sensor.stop() }
}
```

要点：鸿蒙用 `@ohos.sensor` 的旋转矢量传感器；快应用用 `@system.sensor` 的 `deviceMotion`，
字段换算同上；两者都需在模块 `module.json5` 里声明传感器权限。
