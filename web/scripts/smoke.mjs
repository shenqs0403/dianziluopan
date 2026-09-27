import { buildLayers, DIAL_TYPES } from '../src/dial/layers.js'
import { DARK, drawDegreeRing, drawDial, GEO, PALETTE } from '../src/dial/draw.js'
import { judge, azimuthLuck } from '../src/dial/fortune.js'
import { mountainOf, MOUNTAINS } from '../src/dial/mountains.js'

const calls = {}
const texts = []
const ops = []          // 记录绘制操作顺序，用来验证「角度圈在旋转变换之内」
const ctx = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return () => ({ width: 10 })
    return (...a) => {
      calls[k] = (calls[k] || 0) + 1
      ops.push(k)
      if (k === 'fillText') texts.push({ text: a[0], x: a[1], y: a[2], seq: ops.length })
    }
  },
  set() { return true }
})

/** 相对亮度与对比度，用来卡住「配色改了却看不见」这类问题。 */
const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (hex) => {
  const n = [1, 3, 5].map((i) => srgb(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 亮色模式下正方形底色必须跟页面一致，圈上角度必须是黑的，
 * 且两者对比度要够读。之前圈上角度复用深棕 #2E2416 画在深红 #3A0A0A 上，
 * 对比度只有 1.11:1，等于隐形，这类问题只能靠数字卡住。
 */
function checkContrast() {
  for (const [name, c] of [['亮色', PALETTE], ['暗色', DARK]]) {
    const ring = contrast(c.ringText, c.bg)
    if (ring < 4.5) {
      throw new Error(`${name}下圈上角度 ${c.ringText} 对方块底 ${c.bg} 对比度仅 ${ring.toFixed(2)}:1，看不清`)
    }
    // 方块底与页面底一致时，方块只能靠描边区分，描边也得够得着
    if (c.bg === '#F2E7D5') {
      const edge = contrast(c.bgEdge, c.bg)
      if (edge < 3) throw new Error(`${name}下方块底与页面同色，描边 ${c.bgEdge} 对比度仅 ${edge.toFixed(2)}:1`)
      // 盘面若与方块同色，整个方块会糊成一片
      const dial = contrast(c.ringFill, c.bg)
      if (dial < 1.15) throw new Error(`${name}下盘面 ${c.ringFill} 与方块底 ${c.bg} 仅 ${dial.toFixed(2)}:1，糊在一起`)
      // 实时方位线金色在浅底上很容易消失
      const cur = contrast(c.markerCurrent, c.bg)
      if (cur < 3) throw new Error(`${name}下实时方位线 ${c.markerCurrent} 在 ${c.bg} 上仅 ${cur.toFixed(2)}:1`)
    }
    console.log(`配色 ✓ ${name}：圈上角度对底色 ${ring.toFixed(1)}:1` +
      (c.bg === '#F2E7D5'
        ? `，描边 ${contrast(c.bgEdge, c.bg).toFixed(1)}:1，盘面 ${contrast(c.ringFill, c.bg).toFixed(2)}:1，实时线 ${contrast(c.markerCurrent, c.bg).toFixed(1)}:1`
        : ''))
  }
  if (PALETTE.ringText !== '#000000') throw new Error('亮色下圈上角度应为纯黑')
}

/** 角度圈属于盘面层（随内盘一起旋转），0°/180° 用「北」「南」代替数字。 */
function checkDegreeRing() {
  const size = 400
  const cx = size / 2
  const cy = size / 2
  const rIn = size * GEO.dial
  const rOut = size * GEO.ringOuter
  const rText = (rIn + rOut) / 2   // 圈上文字都画在带的正中，用它精确筛选
  texts.length = 0
  drawDegreeRing(ctx, cx, cy, rIn, rOut, DARK, size)
  const labels = texts.map((t) => t.text)
  const want = ['北', '30', '60', '90', '南', '120', '150', '210', '240', '270', '300', '330'].sort()
  if (JSON.stringify(labels.slice().sort()) !== JSON.stringify(want)) {
    throw new Error(`角度圈标签不对：${JSON.stringify(labels)}`)
  }
  const at = (t) => texts.find((x) => x.text === t)
  const north = at('北')
  const south = at('南')
  if (north.y >= cy) throw new Error('「北」必须画在 0°（正上方）')
  if (south.y <= cy) throw new Error('「南」必须画在 180°（正下方）')
  if (at('0') || at('180')) throw new Error('0°/180° 已被「北」「南」占用，不应再画数字')
  // 关键：角度圈必须画在 rotate() 之后，也就是在随盘面旋转的坐标系里
  ops.length = 0
  texts.length = 0
  drawDial(ctx, { size, layers: buildLayers('sanhe', MOUNTAINS[0]), rotation: 30, azimuth: 135,
    sitting: MOUNTAINS[0], facing: null, currentDeg: 135, showRing: true, showCross: false })
  const rotateAt = ops.lastIndexOf('rotate')
  const ringSeqs = texts
    .filter((t) => Math.abs(Math.hypot(t.x, t.y) - rText) < 1)
    .map((t) => t.seq)
  if (ringSeqs.length !== 12) throw new Error(`圈上文字应 12 个，实得 ${ringSeqs.length}`)
  if (ringSeqs.some((q) => q < rotateAt)) {
    throw new Error('角度圈画在 rotate() 之前，不会随内盘旋转')
  }

  // 圈属于盘面：showRing:false 时 drawDial 不画它，否则会被当静止层
  texts.length = 0
  drawDial(ctx, { size, layers: buildLayers('sanhe', MOUNTAINS[0]), rotation: 0, azimuth: 135,
    sitting: MOUNTAINS[0], facing: null, currentDeg: 135, showRing: false })
  // drawDial 内部 translate 到盘心，盘面文字是盘心相对坐标
  const leaked = texts.filter((t) => Math.abs(Math.hypot(t.x, t.y) - rText) < 1)
  if (leaked.length) throw new Error('showRing:false 时角度圈仍被画出，会脱离盘面旋转')
  checkContrast()
  console.log(`\n角度圈 ✓ 12 个标签、0°=北(上) 180°=南(下)、无 0/180 数字`)
  console.log(`角度圈进盘面层 ✓ 12 个标签全部画在 rotate() 之后，确实随内盘旋转`)
  console.log(`角度圈进盘面层 ✓ showRing:false 时不画，不会脱离盘面旋转`)
}

for (const t of DIAL_TYPES) {
  const sit = MOUNTAINS[0]
  const layers = buildLayers(t.key, sit)
  const bad = layers.filter((l) => Math.abs(l.cells.reduce((s, c) => s + c.spanDeg, 0) - 360) > 0.05)
  const empty = layers.filter((l) => l.cells.some((c) => !c.text))
  if (empty.length) throw new Error(`空文字层：${empty.map((l) => l.key).join(',')}`)
  drawDial(ctx, { size: 400, layers, rotation: 0, azimuth: 135, sitting: sit, facing: mountainOf(315), currentDeg: 135, showRing: false })
  const v = judge(t.key, sit, mountainOf(315))
  const al = azimuthLuck(sit, 135)
  console.log(
    `${t.text.padEnd(3)} 环数=${String(layers.length).padStart(2)} 格数=${String(layers.reduce((s, l) => s + l.cells.length, 0)).padStart(4)}`,
    `未满圆=${bad.map((b) => b.key)}`,
    `判读=${v.name} 分=${v.score}`,
    `方位吉凶=${al.text}`
  )
}
console.log('canvas 调用统计:', JSON.stringify(calls))

// 指针方向命中检查：验证 needleLine 由最内层到最外层且无空格
import { needleLine as nl } from '../src/dial/draw.js'
for (const t of DIAL_TYPES) {
  const layers = buildLayers(t.key, MOUNTAINS[3])
  const line = nl(layers, 47)
  const parts = line.split('、')
  console.log(`${t.text} 命中${parts.length}项(应为${layers.length}): ${line}`)
}

checkDegreeRing()
