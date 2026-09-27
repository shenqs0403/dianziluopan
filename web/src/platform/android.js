/**
 * Android 适配：WebView + addJavascriptInterface，注入对象名 DiZhiNative。
 * Kotlin 侧实现见 android/README.md（SensorManager TYPE_ROTATION_VECTOR，
 * minSdk 24 对应 Android 7.0）。
 */
export function createAndroidAdapter(native) {
  return {
    platform: 'android',
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
