/**
 * 浏览器兜底：DeviceOrientationEvent / DeviceMotionEvent。
 * iOS 13+ 需用户手势内 requestPermission()；桌面浏览器用鼠标拖拽也能看到界面。
 */
export function createWebAdapter() {
  const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  const needsPermission =
    supported && typeof window.DeviceOrientationEvent.requestPermission === 'function'
  return {
    platform: 'web',
    hasNative: false,
    supported,
    needsPermission,
    async requestPermission() {
      if (!needsPermission) return true
      try {
        const res = await window.DeviceOrientationEvent.requestPermission()
        return res === 'granted'
      } catch (e) {
        return false
      }
    },
    startSensors() { /* 由 useSensors 自行监听事件 */ },
    stopSensors() { /* 同上 */ },
    setTheme(dark) {
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    },
    vibrate(ms) {
      if (navigator.vibrate) navigator.vibrate(ms)
    },
    keepScreenOn(flag) {
      if (!document.body) return
      document.body.style.setProperty('--keep-awake', flag ? 'always' : 'auto')
    },
    getPrefs() {
      try { return window.localStorage.getItem('diZhiPrefs') } catch (e) { return null }
    },
    setPrefs(json) {
      try { window.localStorage.setItem('diZhiPrefs', json) } catch (e) { /* ignore */ }
    }
  }
}
