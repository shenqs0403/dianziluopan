import { buildLayers, DIAL_TYPES } from '../src/dial/layers.js'
import { drawDial } from '../src/dial/draw.js'
import { judge, azimuthLuck } from '../src/dial/fortune.js'
import { mountainOf, MOUNTAINS } from '../src/dial/mountains.js'

const calls = {}
const ctx = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return () => ({ width: 10 })
    return (...a) => { calls[k] = (calls[k] || 0) + 1; void a }
  },
  set() { return true }
})

for (const t of DIAL_TYPES) {
  const sit = MOUNTAINS[0]
  const layers = buildLayers(t.key, sit)
  const bad = layers.filter((l) => Math.abs(l.cells.reduce((s, c) => s + c.spanDeg, 0) - 360) > 0.05)
  const empty = layers.filter((l) => l.cells.some((c) => !c.text))
  if (empty.length) throw new Error(`空文字层：${empty.map((l) => l.key).join(',')}`)
  drawDial(ctx, { size: 400, layers, rotation: 0, azimuth: 135, sitting: sit, facing: mountainOf(315), currentDeg: 135 })
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
