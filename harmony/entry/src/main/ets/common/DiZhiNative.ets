import { common } from '@kit.AbilityKit'
import { window } from '@kit.ArkUI'
import { webview } from '@kit.ArkWeb'
import { preferences } from '@kit.ArkData'
import { vibrator } from '@kit.SensorServiceKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { hilog } from '@kit.PerformanceAnalysisKit'
import { SensorBus, SensorReading } from './SensorBus'

const TAG = 'DiZhiNative'
const PREFS_NAME = 'diZhi'
const PREFS_KEY = 'prefs'

/**
 * 注入给 Web 的 window.DiZhiNative。
 *
 * ArkUI 的 javaScriptProxy 是**白名单**机制：只有写进 methodList 的方法
 * 才能从 JS 调到这里，漏一个前端就拿到 undefined。
 *
 * 关键约束：web/src/platform/index.js 的 loadPrefs() 是**同步**读 + 立刻
 * JSON.parse 的，所以 getPrefs() 必须同步返回字符串，绝不能返回 Promise。
 * preferences 本身是异步的，所以在 prepare() 里提前把值读进内存缓存，
 * Index.ets 等 prepare() 完成后才挂 Web 组件，避开这个竞态。
 */
export class DiZhiNative {
  private controller: webview.WebviewController | null = null
  private context: common.UIAbilityContext | null = null
  private started: boolean = false
  private lastPush: number = 0
  private mainWindow: window.Window | null = null
  private store: preferences.Preferences | null = null
  private cache: string = ''

  /** javaScriptProxy 的白名单，Index.ets 注册时直接用这个数组 */
  static methodList(): string[] {
    return [
      'startSensors',
      'stopSensors',
      'setTheme',
      'vibrate',
      'keepScreenOn',
      'getPrefs',
      'setPrefs'
    ]
  }

  attach(ctx: common.UIAbilityContext, controller: webview.WebviewController): void {
    this.context = ctx
    this.controller = controller
    // Window 是异步拿的，先落个盘，keepScreenOn 在这之前调用会静默失效
    window.getLastWindow(ctx).then((w: window.Window) => {
      this.mainWindow = w
    }).catch((error: BusinessError) => {
      hilog.error(0x0000, TAG, 'getLastWindow failed: %{public}s', error.message)
    })
  }

  /** 页面挂载前调用：把 preferences 预热进同步可读的内存缓存 */
  async prepare(): Promise<void> {
    const ctx = this.context
    if (ctx == null) {
      return
    }
    try {
      this.store = await preferences.getPreferences(ctx, { name: PREFS_NAME })
      const value = await this.store.get(PREFS_KEY, '')
      this.cache = typeof value === 'string' ? value : JSON.stringify(value)
    } catch (error) {
      const e = error as BusinessError
      // 读不到就用默认值，App.vue 的 loadPrefs 有兜底，这里不用抛
      hilog.warn(0x0000, TAG, 'prefs load failed: %{public}s', e.message)
      this.cache = ''
    }
  }

  release(): void {
    this.stopSensors()
  }

  // ---- 传感器 ----

  startSensors(): void {
    if (this.started) {
      return
    }
    this.started = true
    SensorBus.get().start((reading: SensorReading) => {
      this.push(reading)
    })
  }

  stopSensors(): void {
    if (!this.started) {
      return
    }
    this.started = false
    SensorBus.get().stop()
  }

  // ---- 原生 -> JS ----

  private push(reading: SensorReading): void {
    // 限流到 ~30Hz：ORIENTATION 的回调频率由系统决定，不限会把 Web 线程打满
    const now = Date.now()
    if (now - this.lastPush < 30) {
      return
    }
    this.lastPush = now
    const controller = this.controller
    if (controller == null) {
      return
    }
    const json = JSON.stringify(reading)
    // 加 window.__diZhiBridge && 是为了页面还没加载完时不报错
    const js = `window.__diZhiBridge&&__diZhiBridge.emit('sensor',${json});`
    // 注意：sensor 回调不在 UI 线程，runJavaScript 理想上应在 UI 线程调。
    // 这里直接调是因为 ArkWeb 内部会转交给 web 线程；真机若出现丢帧或异常，
    // 就改成先把 reading 放进 AppStorage，在 Index.ets 的
    // @StorageLink + @Watch 里推（那时一定在 UI 线程）。
    controller.runJavaScript(js).catch((error: BusinessError) => {
      hilog.error(0x0000, TAG, 'runJavaScript failed: %{public}s', error.message)
    })
  }

  /** 生命周期事件，name 只能是 pause / resume / back（见 contract.js） */
  emitEvent(name: string): void {
    const controller = this.controller
    if (controller == null) {
      return
    }
    controller.runJavaScript(`window.__diZhiBridge&&__diZhiBridge.emit('event',{"name":"${name}"});`)
      .catch((error: BusinessError) => {
        hilog.error(0x0000, TAG, 'emitEvent failed: %{public}s', error.message)
      })
  }

  // ---- 以下经 javaScriptProxy 注册后供 JS 同步调用 ----

  setTheme(dark: boolean): void {
    // 页面自己按亮/暗重绘（draw.js 有两套 PALETTE），原生这边是全屏 Web、
    // 没有状态栏要跟着变，所以是空实现。
    // 故意不发 'event'：contract 里 event 只允许 pause/resume/back。
    hilog.debug(0x0000, TAG, 'setTheme dark=%{public}s (no-op on fullscreen web)', String(dark))
  }

  vibrate(durationMs: number): void {
    // 震动只是点按反馈，参数形态随 SDK 变动，失败就当没有反馈，绝不能崩
    try {
      vibrator.startVibration({
        type: 'preset',
        effectId: 'haptic.clock.timer',
        count: 1,
        intensity: 50
      }, {
        id: 0,
        usage: 'alarm'
      }, (error: BusinessError) => {
        if (error) {
          hilog.warn(0x0000, TAG, 'vibrate failed: %{public}s', error.message)
        }
      })
    } catch (error) {
      const e = error as BusinessError
      hilog.warn(0x0000, TAG, 'vibrate threw: %{public}s', e.message)
    }
  }

  keepScreenOn(flag: boolean): void {
    const w = this.mainWindow
    if (w == null) {
      return
    }
    w.setWindowKeepScreenOn(flag).catch((error: BusinessError) => {
      hilog.error(0x0000, TAG, 'keepScreenOn failed: %{public}s', error.message)
    })
  }

  /** 同步返回：数据在 prepare() 里已缓存好 */
  getPrefs(): string {
    return this.cache
  }

  setPrefs(json: string): void {
    // 先同步更新缓存，页面内紧接着的 loadPrefs 就能读到新值
    this.cache = json
    const store = this.store
    if (store == null) {
      return
    }
    store.put(PREFS_KEY, json).then(() => store.flush()).catch((error: BusinessError) => {
      hilog.error(0x0000, TAG, 'setPrefs failed: %{public}s', error.message)
    })
  }
}
