/**
 * 陀螺仪与系统能力的统一接口契约。
 *
 * JS → 原生：原生容器必须注入 window.DiZhiNative（Android addJavascriptInterface、
 * iOS WKScriptMessageHandler、鸿蒙 ArkWeb JavaScriptProxy、快应用 JSBridge 均同名）。
 *
 *   DiZhiNative.startSensors()                 开始推送传感器
 *   DiZhiNative.stopSensors()                  停止推送
 *   DiZhiNative.setTheme(dark: boolean)        同步原生状态栏/背景
 *   DiZhiNative.vibrate(ms: number)            震动反馈
 *   DiZhiNative.keepScreenOn(flag: boolean)    常亮
 *   DiZhiNative.getPrefs() : string | null     读取本地配置（JSON 字符串）
 *   DiZhiNative.setPrefs(json: string)         写入本地配置
 *   DiZhiNative.close()                        退出程序（可选实现）
 *
 * 原生 → JS：原生只需调用同一个入口
 *
 *   window.__diZhiBridge.emit('sensor', { ... })
 *   window.__diZhiBridge.emit('event',  { name: 'pause' | 'resume' | 'back', ... })
 *
 * sensor 负载字段：
 *   azimuth   number  方位角，0=正北，顺时针增大，0~360（必须已补偿磁偏角/漂移）
 *   pitch     number  俯仰，-180~180，抬头为正
 *   roll      number  横滚，-90~90，向右倾为正
 *   accuracy  number  0~3，对齐真北=3
 *   drift     number  陀螺仪零偏角（度），JS 侧可自行补偿
 *   timestamp number  毫秒
 */

export const BRIDGE_GLOBAL = '__diZhiBridge'
export const NATIVE_GLOBAL = 'DiZhiNative'
export const SENSOR_EVENT = 'sensor'
export const APP_EVENT = 'event'

/** 传感器负载的默认形状，缺字段时按此补齐。 */
export function normalizeSensor(raw = {}) {
  return {
    azimuth: ((Number(raw.azimuth) % 360) + 360) % 360,
    pitch: Number.isFinite(Number(raw.pitch)) ? Number(raw.pitch) : 0,
    roll: Number.isFinite(Number(raw.roll)) ? Number(raw.roll) : 0,
    accuracy: Number.isFinite(Number(raw.accuracy)) ? Number(raw.accuracy) : 0,
    drift: Number.isFinite(Number(raw.drift)) ? Number(raw.drift) : 0,
    timestamp: Number(raw.timestamp) || Date.now()
  }
}
