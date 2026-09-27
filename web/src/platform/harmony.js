/**
 * 鸿蒙适配：ArkWeb 的 JavaScriptProxy，注入对象名 DiZhiNative。
 * ArkTS 侧实现见 harmony/README.md（sensor.SensorService，陀螺仪/加速度计）。
 */
export function createHarmonyAdapter(native) {
  return {
    platform: 'harmony',
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
