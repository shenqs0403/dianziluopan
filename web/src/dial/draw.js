/**
 * 罗盘绘制：随主题取色的正方形底、红色天心十字线、天池与指针、按层画内盘。
 * 盘面不随手机旋转，只有指针随方位角转动；盘面旋转只由用户拖拽产生。
 */
import { normalize } from './mountains.js'
import { LUCK_COLOR } from './tables.js'

export const PALETTE = {
  // 正方形底色跟页面底色一致（--bg: #f2e7d5），所以方块只靠 bgEdge 描边区分。
  // 盘面比方块深一档：亮色下两者若同色，整个方块会糊成一片。
  bg: '#F2E7D5',
  bgEdge: '#8A7550',
  cross: '#E53935',
  needleNorth: '#1F5FA8',
  needleSouth: '#D32F2F',
  ringFill: '#E6D5B4',
  ringFillAlt: '#DFCAA5',
  grid: '#8A7B60',
  tick: '#6A5535',
  text: '#2E2416',
  textDim: '#6B5D45',
  // 圈上角度专用：亮色下方块底已变浅，用纯黑才够清楚。
  // 早先复用 text(#2E2416 深棕) 画在 #3A0A0A 深红上，对比度只有 1.11:1，等于隐形。
  ringText: '#000000',
  markerSitting: '#D32F2F',
  markerFacing: '#1F5FA8',
  // 亮色下 #FFB300 只有 1.47:1，在浅底上几乎看不见，换成主题的深琥珀色
  markerCurrent: '#8A5A10',
  // 选定方位：金色已被实时指针占用，选紫罗兰色，明暗两套主题都看得清
  markerSelected: '#7B3FD4'
}

export const DARK = {
  ...PALETTE,
  bg: '#1A0505',
  bgEdge: '#2E0A0A',
  ringFill: '#211C14',
  ringFillAlt: '#2A2419',
  grid: '#7A6A4E',
  tick: '#9A8A66',
  text: '#F2E7D2',
  textDim: '#B5A484',
  ringText: '#F2E7D2',
  markerSelected: '#B388FF'
}

/**
 * 几何比例：内盘半径、刻度圈外沿、天池半径（均占总宽的比例）。
 * 正方形本身已被屏幕宽度卡死（min(宽-4, 高-4) 取宽），放大空间全在正方形内部，
 * 所以内盘尽量吃掉外圈刻度带以外的全部余量。天池不参与放大，保持 0.025。
 */
export const GEO = { dial: 0.468, ringOuter: 0.5, hub: 0.025 }

/** 画一个分格（扇环），返回本环厚度。 */
function drawCell(ctx, cell, rOuter, rInner, cx, cy, colors) {
  const a0 = ((cell.startDeg - 90) * Math.PI) / 180
  const a1 = ((cell.startDeg + cell.spanDeg - 90) * Math.PI) / 180
  ctx.beginPath()
  ctx.arc(cx, cy, rOuter, a0, a1)
  ctx.arc(cx, cy, rInner, a1, a0, true)
  ctx.closePath()
  ctx.fillStyle = cell.color || (cell.index % 2 === 0 ? colors.ringFill : colors.ringFillAlt)
  ctx.fill()
  ctx.strokeStyle = colors.grid
  ctx.lineWidth = 0.6
  ctx.stroke()
}

/** 分格内文字：两字及以上竖向居中，字号自适应环厚与格宽。 */
function drawCellText(ctx, cell, rOuter, rInner, cx, cy, colors, minFont, maxFont) {
  const text = cell.text
  if (!text) return
  const thickness = rOuter - rInner
  const mid = (rOuter + rInner) / 2
  const center = cell.startDeg + cell.spanDeg / 2
  const chars = Array.from(text)
  const vertical = chars.length >= 2
  const maxW = 2 * mid * Math.sin((Math.min(cell.spanDeg, 60) * Math.PI) / 360)
  let size = Math.min(thickness * 0.72, vertical ? thickness * 0.52 : maxW / Math.max(1, chars.length) * 1.02)
  if (maxFont > 0) size = Math.min(size, maxFont)   // 环很厚时不让字撑大
  size = Math.floor(size * 10) / 10
  if (size < minFont) size = minFont
  ctx.fillStyle = cell.luck ? LUCK_COLOR[cell.luck] : colors.text
  ctx.font = `${size}px -apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const a = ((center - 90) * Math.PI) / 180
  const x = cx + Math.cos(a) * mid
  const y = cy + Math.sin(a) * mid
  if (!vertical) {
    ctx.fillText(text, x, y)
    return
  }
  const step = Math.min(size * 1.02, thickness * 0.98)
  const total = step * (chars.length - 1)
  chars.forEach((ch, i) => {
    const oy = y - total / 2 + i * step
    ctx.fillText(ch, x, oy)
  })
}

/** 刻度：minor 度为一小格，major 度为一长格。 */
function drawTicks(ctx, rOuter, cx, cy, colors, spec) {
  if (!spec) return
  const len = (rOuter - rOuter * 0.86) * 0.9
  for (let d = 0; d < 360; d += spec.minor || 1) {
    const major = spec.major ? d % spec.major === 0 : false
    const a = ((d - 90) * Math.PI) / 180
    const l = major ? len * 1.6 : len
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter)
    ctx.lineTo(cx + Math.cos(a) * (rOuter - l), cy + Math.sin(a) * (rOuter - l))
    ctx.strokeStyle = major ? colors.tick : colors.grid
    ctx.lineWidth = major ? 1 : 0.5
    ctx.stroke()
  }
}

/** 天池与红色天心十字线。 */
export function drawHub(ctx, cx, cy, r, colors, azimuth, showCross, size) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = colors.bg
  ctx.fill()
  ctx.strokeStyle = colors.cross
  ctx.lineWidth = 1.4
  ctx.stroke()

  if (showCross) {
    // 天心十字线：贯穿天池并延伸到正方形四边，保证不被指针盖住
    ctx.strokeStyle = colors.cross
    ctx.lineWidth = Math.max(1, r * 0.06)
    ctx.beginPath()
    ctx.moveTo(0, cy); ctx.lineTo(size, cy)
    ctx.moveTo(cx, 0); ctx.lineTo(cx, size)
    ctx.stroke()
  }

  // 指针：蓝针指北、红针指南
  const a = ((azimuth - 90) * Math.PI) / 180
  const north = { x: cx + Math.cos(a) * r * 0.94, y: cy + Math.sin(a) * r * 0.94 }
  const south = { x: cx - Math.cos(a) * r * 0.94, y: cy - Math.sin(a) * r * 0.94 }
  ctx.beginPath()
  ctx.moveTo(north.x, north.y); ctx.lineTo(cx - Math.sin(a) * r * 0.16, cy + Math.cos(a) * r * 0.16)
  ctx.lineTo(cx + Math.sin(a) * r * 0.16, cy - Math.cos(a) * r * 0.16)
  ctx.closePath()
  ctx.fillStyle = colors.needleNorth
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(south.x, south.y); ctx.lineTo(cx - Math.sin(a) * r * 0.12, cy + Math.cos(a) * r * 0.12)
  ctx.lineTo(cx + Math.sin(a) * r * 0.12, cy - Math.cos(a) * r * 0.12)
  ctx.closePath()
  ctx.fillStyle = colors.needleSouth
  ctx.fill()
}

/**
 * 外圈角度刻度：画在内盘与正方形之间的空隙圆周上，0°~360°。
 * 这层属于外框，不随盘面拖动旋转，所以每帧单独画，不进盘面缓存。
 */
export function drawDegreeRing(ctx, cx, cy, rInner, rOuter, colors, size) {
  const rText = (rInner + rOuter) / 2
  // 刻度带被内盘压缩后，字号要跟着带宽走，否则数字会溢出到正方形外框上
  const font = Math.max(6.5, Math.min(size * 0.026, (rOuter - rInner) * 0.75))
  ctx.save()
  ctx.font = `bold ${font}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let d = 0; d < 360; d += 1) {
    const a = ((d - 90) * Math.PI) / 180
    const major = d % 10 === 0
    const len = major ? (rOuter - rInner) * 0.4 : (rOuter - rInner) * 0.18
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter)
    ctx.lineTo(cx + Math.cos(a) * (rOuter - len), cy + Math.sin(a) * (rOuter - len))
    ctx.strokeStyle = major ? colors.tick : colors.grid
    ctx.lineWidth = major ? 1 : 0.5
    ctx.stroke()
  }

  // 每 30° 一个数字，0° 落在正上方；0°/180° 用「北」「南」代替数字
  const CARDINAL = { 0: '北', 180: '南' }
  ctx.fillStyle = colors.ringText
  for (let d = 0; d < 360; d += 30) {
    const a = ((d - 90) * Math.PI) / 180
    const label = CARDINAL[d] || String(d)
    if (CARDINAL[d]) {
      ctx.font = `bold ${font * 1.05}px sans-serif`
      ctx.fillText(label, cx + Math.cos(a) * rText, cy + Math.sin(a) * rText)
      ctx.font = `bold ${font}px sans-serif`
    } else {
      ctx.fillText(label, cx + Math.cos(a) * rText, cy + Math.sin(a) * rText)
    }
  }
  ctx.restore()
}

/**
 * 在盘上标记某个方位角。
 * 标记落在最外一格上，文字朝盘心方向排，避免压到外圈角度刻度。
 */
export function drawMarker(ctx, cx, cy, r, deg, label, color, colors) {
  const a = ((deg - 90) * Math.PI) / 180
  ctx.beginPath()
  ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.font = `bold ${Math.max(9, r * 0.06)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = colors.text
  const rText = r * 0.9
  ctx.fillText(label, cx + Math.cos(a) * rText, cy + Math.sin(a) * rText)
}

/**
 * 主绘制。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} o 布局与状态
 */
export function drawDial(ctx, o) {
  const {
    size, layers, rotation, azimuth, colors = PALETTE, sitting, facing, currentDeg,
    highlight, minFont = 5, maxFont = 0, showCross = true, showRing = true, markers = true
  } = o
  const cx = size / 2
  const cy = size / 2
  const dialR = size * GEO.dial // 内盘
  const hubR = size * GEO.hub   // 天池

  ctx.save()
  ctx.clearRect(0, 0, size, size)

  // 底色（黑红）与外框
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = colors.bgEdge
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)

  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)

  const ringGap = 1
  const usable = dialR - hubR * 1.6
  const each = usable / Math.max(1, layers.length)
  let rOuter = dialR
  layers.forEach((layer, li) => {
    const rInner = rOuter - each + ringGap
    drawTicks(ctx, rOuter, 0, 0, colors, layer.ticks)
    layer.cells.forEach((cell, i) => {
      drawCell(ctx, { ...cell, index: i }, rOuter, rInner, 0, 0, colors)
    })
    layer.cells.forEach((cell) => {
      if (highlight && highlight.layerKey === layer.key && highlight.cellText === cell.text) {
        ctx.save()
        ctx.beginPath()
        const a0 = ((cell.startDeg - 90) * Math.PI) / 180
        const a1 = ((cell.startDeg + cell.spanDeg - 90) * Math.PI) / 180
        ctx.arc(0, 0, rOuter, a0, a1)
        ctx.arc(0, 0, rInner, a1, a0, true)
        ctx.closePath()
        ctx.strokeStyle = LUCK_COLOR.focus
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
    })
    layer.cells.forEach((cell) => {
      drawCellText(ctx, cell, rOuter - 1, rInner + 1, 0, 0, colors, minFont, maxFont)
    })
    rOuter = rInner
    void li
  })

  // 坐山 / 朝山标记随盘面旋转
  if (markers) {
    const rMark = dialR - each * 0.5
    if (sitting) drawMarker(ctx, 0, 0, rMark, sitting.centerDeg, '坐', colors.markerSitting, colors)
    if (facing) drawMarker(ctx, 0, 0, rMark, facing.centerDeg, '朝', colors.markerFacing, colors)
  }

  // 外圈角度刻度：属于盘面，跟着一起转，所以画在 save/rotate 之内、盘心用 (0,0)。
  // 放在天池十字线之前画，0/90/180/270 的长刻度才不会盖住十字线端点。
  if (showRing) drawDegreeRing(ctx, 0, 0, dialR, size * GEO.ringOuter, colors, size)

  ctx.restore()

  // 天池在盘面之上，不随盘面旋转
  drawHub(ctx, cx, cy, hubR, colors, azimuth, showCross, size)

  // 当前手机方位标记（不随盘面旋转，只随方位角）
  if (currentDeg != null) {
    const a = ((currentDeg - 90) * Math.PI) / 180
    const rEnd = size * GEO.ringOuter
    ctx.save()
    ctx.strokeStyle = colors.markerCurrent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * (hubR + 2), cy + Math.sin(a) * (hubR + 2))
    ctx.lineTo(cx + Math.cos(a) * rEnd, cy + Math.sin(a) * rEnd)
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * 指针方向命中的格子文字：由最内层到最外层依次取出，用「、」连接。
 * @param {Array} layers 分层（由外到内）
 * @param {number} deg 盘面方位角（已扣除盘面旋转）
 */
export function needleLine(layers, deg) {
  const d = normalize(deg)
  return layers
    .slice()
    .reverse()
    .map((layer) => {
      const cell = layer.cells.find((c) => {
        const rel = normalize(d - normalize(c.startDeg))
        return rel <= c.spanDeg + 1e-6 || rel >= 360 - 1e-6
      })
      return cell ? cell.text : ''
    })
    .filter(Boolean)
    .join('、')
}

/** 由屏幕坐标求盘面方位角（用于点击放山）。 */
export function angleAt(x, y, size) {
  const cx = size / 2
  const cy = size / 2
  return normalize((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90)
}

export { normalize }
