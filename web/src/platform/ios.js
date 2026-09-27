/**
 * iOS 适配：WKWebView + WKScriptMessageHandler。
 * Swift 侧把 userContentController 命名为 dianzhi，JS 通过 postMessage 发送
 * { type, payload }，原生回调用 window.__diZhiBridge.emit(...)。
 */
export function createIosAdapter() {
  const handler = window.webkit?.messageHandlers?.dianzhi
  const send = (type, payload) => {
    try {
      handler?.postMessage({ type, payload: payload ?? null })
    } catch (e) {
      /* 原生未注册时忽略 */
    }
  }
  return {
    platform: 'ios',
    hasNative: !!handler,
    startSensors() { send('startSensors') },
    stopSensors() { send('stopSensors') },
    setTheme(dark) { send('setTheme', !!dark) },
    vibrate(ms) { send('vibrate', ms) },
    keepScreenOn(flag) { send('keepScreenOn', !!flag) },
    getPrefs() { try { return window.localStorage.getItem('diZhiPrefs') } catch (e) { return null } },
    setPrefs(json) { try { window.localStorage.setItem('diZhiPrefs', json) } catch (e) { /* ignore */ } }
  }
}
