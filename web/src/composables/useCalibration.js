/**
 * 陀螺仪「8」字校对：检测方位角的大幅往返运动，累计到阈值后自动完成。
 * 判定：单次往返幅度 ≥ 100°、累计行程 ≥ 360°、方向反转 ≥ 2 次、采样不中断超过 1.2s。
 * 校准得到的零偏（drift）由 JS 侧补偿，因此四端共用同一段逻辑。
 */
import { computed, ref } from 'vue'

const REVERSAL_DEG = 100
const TOTAL_DEG = 360
const MIN_REVERSALS = 2
const BREAK_MS = 1200
const MIN_MS = 2000      // 至少持续 2 秒，避免传感器抖动被误判成「画 8 字」
const MAX_STEP = 45      // 单帧计入的最大角度，滤掉突跳/爆表
const MIN_SAMPLES = 30   // 至少 30 个有效采样（约 1 秒 @30Hz）

export function useCalibration(azimuth) {
  const running = ref(false)
  const progress = ref(0)
  const reversals = ref(0)
  const offset = ref(0)
  const lastSample = ref(0)
  let prev = null
  let dir = 0
  let anchor = null
  let total = 0
  let startedAt = 0
  let samples = 0

  const done = computed(() => !running.value && progress.value >= 1)
  const statusText = computed(() => {
    if (progress.value >= 1) return '校对完成'
    if (total >= TOTAL_DEG && reversals.value >= MIN_REVERSALS) return '正在确认…'
    if (reversals.value >= 1) return '继续画圈，方向再反转一次'
    return '请缓慢、连贯地画「8」字'
  })

  function feed(deg, now = Date.now()) {
    if (!running.value) return
    if (lastSample.value && now - lastSample.value > BREAK_MS) {
      // 中断过久，重新累计
      prev = deg
      anchor = deg
      dir = 0
    }
    lastSample.value = now
    if (prev == null) {
      prev = deg
      anchor = deg
      return
    }
    let delta = deg - prev
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    if (Math.abs(delta) < 0.4) return
    prev = deg
    const nd = Math.sign(delta)
    if (dir === 0) {
      dir = nd
      anchor = deg
    } else if (nd !== dir) {
      const swing = Math.abs(anchor - deg)
      if (swing >= REVERSAL_DEG) {
        reversals.value += 1
        offset.value = ((offset.value * 9 + (anchor - deg) / 2) / 10)
        anchor = deg
      }
    }
    total += Math.min(Math.abs(delta), MAX_STEP)
    samples += 1
    progress.value = Math.min(1, (total / TOTAL_DEG) * 0.6 + (reversals.value / MIN_REVERSALS) * 0.4)
    if (total >= TOTAL_DEG && reversals.value >= MIN_REVERSALS &&
        now - startedAt >= MIN_MS && samples >= MIN_SAMPLES
    ) {
      running.value = false
      progress.value = 1
    }
  }

  function start() {
    running.value = true
    progress.value = 0
    reversals.value = 0
    total = 0
    prev = null
    dir = 0
    anchor = null
    lastSample.value = 0
    startedAt = Date.now()
    samples = 0
  }

  function skip() {
    running.value = false
  }

  return { running, progress, reversals, offset, done, statusText, feed, start, skip }
}
