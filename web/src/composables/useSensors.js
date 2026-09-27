/**
 * 传感器订阅：方位角 / 俯仰 / 横滚。
 * 原生推送走 __diZhiBridge.emit('sensor')，浏览器预览走 DeviceOrientationEvent。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { device, onSensor, platform } from '../platform/index.js'

export function useSensors() {
  const azimuth = ref(0)
  const pitch = ref(0)
  const roll = ref(0)
  const accuracy = ref(0)
  const drift = ref(0)
  const active = ref(false)
  const denied = ref(false)
  let unlisten = null
  let handler = null
  let motionHandler = null

  function apply({ azimuth: a, pitch: p, roll: r, accuracy: ac, drift: d }) {
    if (a != null) azimuth.value = a
    if (p != null) pitch.value = p
    if (r != null) roll.value = r
    if (ac != null) accuracy.value = ac
    if (d != null) drift.value = d
  }

  async function start() {
    if (active.value) return
    if (platform === 'web' && device.requestPermission) {
      const ok = await device.requestPermission()
      if (!ok) {
        denied.value = true
        return
      }
    }
    active.value = true
    unlisten = onSensor(apply)
    if (platform === 'web') {
      handler = (e) => {
        if (e.alpha == null && e.webkitCompassHeading == null) return
        const heading = e.webkitCompassHeading != null ? e.webkitCompassHeading : 360 - e.alpha
        apply({
          azimuth: (heading + drift.value) % 360,
          pitch: e.beta || 0,
          roll: e.gamma || 0,
          accuracy: e.absolute ? 3 : 2
        })
      }
      motionHandler = (e) => {
        const g = e.accelerationIncludingGravity || {}
        if (g.x == null) return
        apply({ roll: Math.atan2(g.x, g.z) * (180 / Math.PI) })
      }
      window.addEventListener('deviceorientation', handler, true)
      window.addEventListener('devicemotion', motionHandler, true)
    }
    device.startSensors()
    device.keepScreenOn(true)
  }

  function stop() {
    if (!active.value) return
    active.value = false
    if (unlisten) unlisten()
    unlisten = null
    if (platform === 'web') {
      if (handler) window.removeEventListener('deviceorientation', handler, true)
      if (motionHandler) window.removeEventListener('devicemotion', motionHandler, true)
      handler = null
      motionHandler = null
    }
    device.stopSensors()
  }

  onMounted(start)
  onBeforeUnmount(stop)

  return { azimuth, pitch, roll, accuracy, drift, active, denied, start, stop, platform }
}
