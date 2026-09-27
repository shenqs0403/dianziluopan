/**
 * 平台适配总入口：按注入对象自动选择 Android / iOS / 鸿蒙 / 快应用，缺省回退浏览器。
 * 对外只暴露统一接口，界面层不感知具体平台。
 */
import { createAndroidAdapter } from './android.js'
import { createIosAdapter } from './ios.js'
import { createHarmonyAdapter } from './harmony.js'
import { createQuickAppAdapter } from './quickapp.js'
import { createWebAdapter } from './web.js'
import { BRIDGE_GLOBAL, NATIVE_GLOBAL, SENSOR_EVENT, APP_EVENT, normalizeSensor } from './contract.js'

const listeners = { sensor: new Set(), event: new Set() }

/** 供原生调用的唯一入口。 */
function emit(type, payload) {
  const data = type === SENSOR_EVENT ? normalizeSensor(payload) : payload || {}
  listeners[type].forEach((fn) => {
    try { fn(data) } catch (e) { /* 单个订阅者异常不影响其他订阅者 */ }
  })
}

if (typeof window !== 'undefined' && !window[BRIDGE_GLOBAL]) {
  window[BRIDGE_GLOBAL] = { emit, version: '1.0' }
}

function detect() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
  const native = window[NATIVE_GLOBAL]
  if (native) {
    if (/harmony|ohos|arkweb/i.test(ua) || native.__platform === 'harmony') return createHarmonyAdapter(native)
    if (native.__platform === 'quickapp') return createQuickAppAdapter(native)
    if (/quickapp| hap /i.test(ua)) return createQuickAppAdapter(native)
    if (/iphone|ipad|ipod/i.test(ua)) return createIosAdapter()
    return createAndroidAdapter(native)
  }
  if (/iphone|ipad|ipod/i.test(ua)) return createIosAdapter()
  return createWebAdapter()
}

const adapter = detect()

export const platform = adapter.platform
export const hasNative = adapter.hasNative
export const sensorSupported = adapter.supported !== false

export function onSensor(fn) {
  listeners.sensor.add(fn)
  return () => listeners.sensor.delete(fn)
}

export function onAppEvent(fn) {
  listeners.event.add(fn)
  return () => listeners.event.delete(fn)
}

export const device = {
  platform,
  hasNative,
  startSensors: () => adapter.startSensors(),
  stopSensors: () => adapter.stopSensors(),
  setTheme: (dark) => adapter.setTheme(dark),
  vibrate: (ms) => adapter.vibrate(ms),
  keepScreenOn: (flag) => adapter.keepScreenOn(flag),
  getPrefs: () => adapter.getPrefs(),
  setPrefs: (json) => adapter.setPrefs(json),
  requestPermission: () => (adapter.requestPermission ? adapter.requestPermission() : Promise.resolve(true))
}

/** 读取 JSON 配置，失败返回默认值。 */
export function loadPrefs(defaults = {}) {
  const raw = device.getPrefs()
  if (!raw) return { ...defaults }
  try {
    return { ...defaults, ...JSON.parse(raw) }
  } catch (e) {
    return { ...defaults }
  }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs({}), ...patch }
  device.setPrefs(JSON.stringify(next))
  return next
}

export { SENSOR_EVENT, APP_EVENT }
