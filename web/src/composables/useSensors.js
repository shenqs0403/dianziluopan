/**
 * 传感器订阅：方位角 / 俯仰 / 横滚。
 * 原生推送走 __diZhiBridge.emit('sensor')，浏览器预览走 DeviceOrientationEvent。
 *
 * 原始读数的抖动（磁异常的瞬时毛刺、手持微颤）会让指针和水平仪晃得厉害，
 * 这里统一做时间常数 τ 的低通平滑。方位角跨 0/360 接缝按「最短弧」插值，
 * 平滑期间不会让指针猛转一整圈；平缓与跟手之间取 τ=300ms。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { device, onSensor, platform } from '../platform/index.js'

const TAU_MS = 300

/** 跨 0/360 的最短有向差（-180..180）。 */
function wrapDelta(prev, next) {
  return ((next - prev + 540) % 360) - 180
}

/** 归一化到 [0, 360)。 */
function norm360(d) {
  return ((d % 360) + 360) % 360
}

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

  // 平滑状态：跨 start/stop 保留，大时间间隔时 α→1 即刻跟上
  let smoothT = 0
  let smoothAz = null
  let smoothPitch = null
  let smoothRoll = null

  function apply({ azimuth: a, pitch: p, roll: r, accuracy: ac, drift: d }) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = smoothT ? now - smoothT : TAU_MS
    smoothT = now
    const alpha = 1 - Math.exp(-dt / TAU_MS)

    if (a != null) {
      const v = norm360(a)
      smoothAz = smoothAz == null ? v : norm360(smoothAz + wrapDelta(smoothAz, v) * alpha)
      azimuth.value = smoothAz
    }
    if (p != null) {
      smoothPitch = smoothPitch == null ? p : smoothPitch + (p - smoothPitch) * alpha
      pitch.value = smoothPitch
    }
    if (r != null) {
      smoothRoll = smoothRoll == null ? r : smoothRoll + (r - smoothRoll) * alpha
      roll.value = smoothRoll
    }
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
          // deviceorientation 的 beta 以「竖着拿」为 0°、平放为 90°，
          // 转成与原生 tilt 一致的帧：平放 0°，顶边抬起为正。
          pitch: (e.beta || 0) - 90,
          accuracy: e.absolute ? 3 : 2
        })
      }
      motionHandler = (e) => {
        const g = e.accelerationIncludingGravity || {}
        if (g.x == null) return
        // 重力加速度读数即「向上的承托方向」：g.x>0 ⇔ 承托方向偏右 ⇔ 右侧抬起，
        // 与水平仪帧（roll>0＝右高）一致，直接用，不取负。
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
