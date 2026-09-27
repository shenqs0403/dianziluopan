import { common } from '@kit.AbilityKit'
import { webview } from '@kit.ArkWeb'
import { DiZhiNative } from '../common/DiZhiNative'
import { hilog } from '@kit.PerformanceAnalysisKit'

const TAG = 'DiZhiIndex'

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController()
  native: DiZhiNative = new DiZhiNative()
  // preferences 是异步读的，prepare() 完成前先不挂 Web，
  // 否则页面里同步的 loadPrefs() 会读到空值（丢「已校准」「深色」等状态）
  @State ready: boolean = false

  aboutToAppear(): void {
    const ctx = getContext(this) as common.UIAbilityContext
    this.native.attach(ctx, this.controller)
    this.native.prepare().then(() => {
      this.ready = true
    }).catch(() => {
      this.ready = true
    })
  }

  aboutToDisappear(): void {
    // 必须停监听，否则退到后台还在跑传感器
    this.native.release()
  }

  onPageHide(): void {
    this.native.stopSensors()
    this.native.emitEvent('pause')
  }

  onPageShow(): void {
    this.native.emitEvent('resume')
  }

  build() {
    Column() {
      if (this.ready) {
        Web({ src: $rawfile('www/index.html'), controller: this.controller })
          .javaScriptAccess(true)
          .javaScriptProxy({
            object: this.native,
            name: 'DiZhiNative',
            // 白名单漏一个，前端拿到 undefined
            methodList: DiZhiNative.methodList(),
            controller: this.controller
          })
          .domStorageAccess(true)
          .fileAccess(true)
          .imageAccess(true)
          .mediaPlayGestureAccess(false)
          .zoomAccess(false)
          .width('100%')
          .height('100%')
          .backgroundColor('#120A05')
          .onControllerAttached(() => {
            // 方便 DevEco 的 DevTools 直接调 console 调试
            this.controller.setWebDebuggingAccess(true)
            // platform/index.js 的 detect() 优先看 native.__platform。
            // javaScriptProxy 的白名单只暴露 methodList 里的方法，普通属性读不到，
            // 所以在页面里补一个标记，让平台判断不依赖 UA 猜测。
            this.controller.runJavaScript(
              "window.DiZhiNative&&(window.DiZhiNative.__platform='harmony');")
              .catch(() => {
                hilog.warn(0x0000, TAG, 'set __platform failed')
              })
            hilog.info(0x0000, TAG, 'web controller attached')
          })
      } else {
        // 与 draw.js 的深色底一致，避免首帧白闪
        Column().width('100%').height('100%').backgroundColor('#120A05')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#120A05')
  }
}
