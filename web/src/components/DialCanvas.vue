<script setup>
/**
 * 2.3 第二部分：罗盘画布。
 * 画布为屏幕宽度减 4px 的正方形，黑红底、红色天心十字线、天池 5%、
 * 内盘 90%；按下拖拽按方向旋转盘面，松手立即停止；盘面不随手机旋转。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildLayers } from '../dial/layers.js'
import { DARK, GEO, PALETTE, angleAt, drawDial, drawHub } from '../dial/draw.js'
import { normalize } from '../dial/mountains.js'

const props = defineProps({
  azimuth: { type: Number, default: 0 },
  roll: { type: Number, default: 0 },
  type: { type: String, default: 'sanhe' },
  dark: { type: Boolean, default: false },
  sitting: { type: Object, default: null },
  facing: { type: Object, default: null },
  /** 选定方位：null 表示跟随陀螺仪 */
  selected: { type: Number, default: null },
  step: { type: Number, default: 0 }
})
const emit = defineEmits(['pick', 'clear', 'rotate'])

const wrap = ref(null)
const canvas = ref(null)
const rotation = ref(0)
const dragging = ref(false)
const boxSize = ref(0)
let ctx = null
let lastAngle = null
let moved = 0
// 长按清空已放的坐山 / 朝山（底部不再保留「清除」按钮）
let holdTimer = 0

/**
 * 盘面离屏缓存：22 环共 972 格，逐帧重画 + 逐格文字在手机上要 300~1000ms，
 * 传感器 30Hz 根本跟不上。这里把「不随传感器变化的盘面」画一次到离屏画布，
 * 每帧只做一次 drawImage 旋转 + 天池 + 指针。
 */
let plate = null
let plateCtx = null
let plateKey = ''

function plateSignature() {
  return [
    boxSize.value,
    props.type,
    props.dark,
    layerCount.value,
    props.sitting?.text || '',
    props.facing?.text || '',
    window.devicePixelRatio || 1
  ].join('|')
}

function ensurePlate() {
  const key = plateSignature()
  if (plateKey === key && plate) return
  const size = boxSize.value
  const dpr = window.devicePixelRatio || 1
  if (!plate) {
    plate = document.createElement('canvas')
    plateCtx = plate.getContext('2d')
  }
  plate.width = Math.round(size * dpr)
  plate.height = Math.round(size * dpr)
  plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawDial(plateCtx, {
    size,
    layers: layers.value,
    rotation: 0,            // 盘面缓存成 0°，旋转交给 drawImage
    azimuth: 0,
    colors: colors.value,
    sitting: props.sitting,
    facing: props.facing,
    currentDeg: null,       // 当前方位标记每帧单独画
    minFont: Math.max(4, size * 0.008),
    maxFont: Math.max(8, size * 0.018),
    highlight: null,
    showCross: false,       // 十字线不随盘面旋转
    showRing: true,         // 角度圈随内盘一起转，所以要进缓存
    markers: true
  })
  plateKey = key
}

const layers = computed(() => buildLayers(props.type, props.sitting))
const colors = computed(() => (props.dark ? DARK : PALETTE))
const layerCount = computed(() => layers.value.length)

function resize() {
  const el = wrap.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  const size = Math.max(160, Math.min(w - 4, h - 4))
  boxSize.value = size
  const dpr = window.devicePixelRatio || 1
  const c = canvas.value
  c.width = Math.round(size * dpr)
  c.height = Math.round(size * dpr)
  c.style.width = `${size}px`
  c.style.height = `${size}px`
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  plateKey = ''          // 尺寸变化后强制重建缓存
  render()
}

function render() {
  if (!ctx || !boxSize.value) return
  const size = boxSize.value
  const dialR = size * GEO.dial
  const hubR = size * GEO.hub
  const c = colors.value

  ensurePlate()

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, size, size)

  // 缓存盘面：一次 drawImage 完成旋转。角度圈已经在缓存里，跟着一起转。
  const cx = size / 2
  const cy = size / 2
  const rEnd = size * GEO.ringOuter

  ctx.save()
  ctx.translate(size / 2, size / 2)
  ctx.rotate((rotation.value * Math.PI) / 180)
  ctx.drawImage(plate, -size / 2, -size / 2, size, size)

  // 选定方位：盘面坐标，要和盘面一起转
  if (props.selected != null) {
    const sa = ((props.selected - 90) * Math.PI) / 180
    const rs = dialR
    const re = rEnd
    ctx.strokeStyle = c.markerSelected
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(Math.cos(sa) * (rs + (re - rs) * 0.15), Math.sin(sa) * (rs + (re - rs) * 0.15))
    ctx.lineTo(Math.cos(sa) * re, Math.sin(sa) * re)
    ctx.stroke()
    // 端点小圆，和实时指针的金色区分开
    ctx.fillStyle = c.markerSelected
    ctx.beginPath()
    ctx.arc(Math.cos(sa) * re, Math.sin(sa) * re, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 天池、十字线、指针、当前方位标记这四层都不随盘面旋转

  drawHub(ctx, cx, cy, hubR, c, props.azimuth, true, size)

  // 当前手机方位：只随方位角
  const a = ((props.azimuth - 90) * Math.PI) / 180
  ctx.save()
  ctx.strokeStyle = c.markerCurrent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx + Math.cos(a) * (hubR + 2), cy + Math.sin(a) * (hubR + 2))
  ctx.lineTo(cx + Math.cos(a) * rEnd, cy + Math.sin(a) * rEnd)
  ctx.stroke()
  ctx.restore()
}

function localPoint(ev) {
  const rect = canvas.value.getBoundingClientRect()
  // touchend / touchcancel 时 ev.touches 是空的，得从 changedTouches 取最后触点
  let t = null
  if (ev.touches && ev.touches.length) t = ev.touches[0]
  else if (ev.changedTouches && ev.changedTouches.length) t = ev.changedTouches[0]
  else t = ev
  return { x: t.clientX - rect.left, y: t.clientY - rect.top }
}

function clearHold() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = 0
  }
}

function onDown(ev) {
  dragging.value = true
  moved = 0
  lastAngle = angleAt(localPoint(ev).x, localPoint(ev).y, boxSize.value)
  // 指针已释放时 setPointerCapture 会抛 NotFoundError，包一层免得后面的长按逻辑不执行
  if (ev.pointerId != null) {
    try { canvas.value.setPointerCapture?.(ev.pointerId) } catch { /* 忽略 */ }
  }
  clearHold()
  holdTimer = setTimeout(() => {
    holdTimer = 0
    dragging.value = false
    lastAngle = null
    moved = 999           // 抑制松手时的放山
    emit('clear')
  }, 600)
  if (ev.cancelable && ev.preventDefault) ev.preventDefault()
}

function onMove(ev) {
  if (!dragging.value) return
  if (moved > 6) clearHold()   // 拖动盘面不算长按
  const p = localPoint(ev)
  const a = angleAt(p.x, p.y, boxSize.value)
  let delta = a - lastAngle
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  lastAngle = a
  moved += Math.abs(delta)
  // 盘面跟手旋转，松手即停
  rotation.value = normalize(rotation.value + delta)
  emit('rotate', rotation.value)   // 底部右侧要按指针在转过来的盘面上所指来显示
  render()
  if (ev.cancelable && ev.preventDefault) ev.preventDefault()
}

function onUp(ev) {
  if (!dragging.value) return
  dragging.value = false
  lastAngle = null
  clearHold()
  // 拖动距离很小视为点击
  if (moved < 4) {
    // 内盘、外圈、方角，点哪都是「相对盘心的方位」。
    // 角度圈现在跟着盘面转，所以要扣掉拖拽出来的 rotation 才是圈上的读数。
    const p = localPoint(ev)
    emit('pick', normalize(angleAt(p.x, p.y, boxSize.value) - rotation.value))
  }
  if (ev.cancelable && ev.preventDefault) ev.preventDefault()
}

// 供外部读取盘面旋转角与当前分层，用于计算指针命中的格子
defineExpose({ rotation, layers, boxSize })

let unbindInteractions = null

/**
 * 归一化拖拽/点击的监听绑定：Android 7 的 Chromium 51 没有 PointerEvent，
 * 只有 touch / mouse。按浏览器能力只绑一种事件源，避免双触发
 * （Chrome 51 里 pointer 和 touch 都会出现，但 touch 的 preventDefault 会
 * 抑制合成鼠标事件）。
 */
function bindInteractions() {
  const c = canvas.value
  if (!c) return
  const down = onDown, move = onMove, up = onUp
  let detach = null
  if (window.PointerEvent) {
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    detach = () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
    }
  } else if ('ontouchstart' in window) {
    // Android 7 WebView（Chromium 51）
    c.addEventListener('touchstart', down, { passive: false })
    c.addEventListener('touchmove', move, { passive: false })
    c.addEventListener('touchend', up)
    c.addEventListener('touchcancel', up)
    detach = () => {
      c.removeEventListener('touchstart', down)
      c.removeEventListener('touchmove', move)
      c.removeEventListener('touchend', up)
      c.removeEventListener('touchcancel', up)
    }
  } else {
    // 桌面网页预览：鼠标拖拽
    c.addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    detach = () => {
      c.removeEventListener('mousedown', down)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }
  unbindInteractions = detach
}

onBeforeUnmount(() => {
  clearHold()
  if (unbindInteractions) unbindInteractions()
  unbindInteractions = null
})

onMounted(() => {
  resize()
  bindInteractions()
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', () => setTimeout(resize, 120))
})
watch(
  () => [props.azimuth, props.type, props.dark, props.sitting, props.facing, props.step,
    props.selected, layerCount.value],
  render
)
// 传感器 30Hz 推送时用 rAF 合帧，避免同一帧内重复重画
let frame = 0
watch(
  () => props.azimuth,
  () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      render()
    })
  }
)
</script>

<template>
  <div ref="wrap" class="wrap">
    <canvas
      ref="canvas"
      class="dial"
    />
  </div>
</template>

<style scoped>
.wrap {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
}
.dial { display: block; touch-action: none; }
</style>
