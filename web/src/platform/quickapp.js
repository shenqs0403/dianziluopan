/**
 * 鸿蒙快应用适配：快应用内嵌 webview 的 JSBridge，同样注入 DiZhiNative。
 * 快应用侧实现见 harmony/README.md（@system.sensor）。
 */
export function createQuickAppAdapter(native) {
  return {
    platform: 'quickapp',
    hasNative: !!native,
    startSensors() { native?.startSensors?.() },
    stopSensors() { native?.stopSensors?.() },
    setTheme(dark) { native?.setTheme?.(!!dark) },
    vibrate(ms) { native?.vibrate?.(ms) },
    keepScreenOn(flag) { native?.keepScreenOn?.(!!flag) },
    getPrefs() { try { return native?.getPrefs?.() || null } catch (e) { return null } },
    setPrefs(json) { native?.setPrefs?.(json) }
  }
}
