/**
 * 二十四山基础数据。
 * 正北为 0°，顺时针增大（东 90°，南 180°，西 270°），每山 15°。
 * gan 纳甲天干、zhi 纳甲地支、group 三合局、yang 阳龙/阴龙、palace 卦宫。
 */
export const PALACE = {
  KAN: { trigram: '坎', wuxing: '水', zhi: '子' },
  GEN: { trigram: '艮', wuxing: '土', zhi: '丑' },
  ZHEN: { trigram: '震', wuxing: '木', zhi: '寅' },
  XUN: { trigram: '巽', wuxing: '木', zhi: '巳' },
  LI: { trigram: '离', wuxing: '火', zhi: '午' },
  KUN: { trigram: '坤', wuxing: '土', zhi: '未' },
  DUI: { trigram: '兑', wuxing: '金', zhi: '酉' },
  QIAN: { trigram: '乾', wuxing: '金', zhi: '亥' }
}

const RAW = [
  // 名称, 中心角, 天干, 卦宫, 三合局, 阴阳
  ['子', 0, '壬', 'KAN', 'water', true],
  ['癸', 15, '癸', 'KAN', 'water', false],
  ['丑', 30, '己', 'GEN', 'earth', false],
  ['艮', 45, '丙', 'GEN', 'earth', true],
  ['寅', 60, '甲', 'ZHEN', 'fire', false],
  ['甲', 75, '甲', 'ZHEN', 'fire', true],
  ['卯', 90, '乙', 'ZHEN', 'wood', true],
  ['乙', 105, '乙', 'XUN', 'wood', false],
  ['辰', 120, '己', 'XUN', 'earth', false],
  ['巽', 135, '辛', 'XUN', 'wood', true],
  ['巳', 150, '丙', 'XUN', 'metal', false],
  ['丙', 165, '丙', 'LI', 'fire', true],
  ['午', 180, '丁', 'LI', 'fire', false],
  ['丁', 195, '丁', 'LI', 'fire', true],
  ['未', 210, '己', 'KUN', 'wood', false],
  ['坤', 225, '乙', 'KUN', 'earth', true],
  ['申', 240, '庚', 'KUN', 'water', false],
  ['庚', 255, '庚', 'DUI', 'metal', true],
  ['酉', 270, '辛', 'DUI', 'metal', false],
  ['辛', 285, '辛', 'DUI', 'metal', true],
  ['戌', 300, '戊', 'QIAN', 'fire', false],
  ['乾', 315, '甲', 'QIAN', 'earth', true],
  ['亥', 330, '戊', 'QIAN', 'wood', false],
  ['壬', 345, '壬', 'KAN', 'water', true]
]

export const MOUNTAINS = RAW.map(([text, centerDeg, gan, palace, group, yangYang], index) => ({
  text,
  centerDeg,
  gan,
  palace,
  group,
  yangYang,
  zhi: PALACE[palace].zhi,
  index
}))

/** 三合局定义：生门、库位、四正。 */
export const GROUPS = {
  water: { text: '水局', wuxing: '水', shengStart: 240, 库: '辰' },
  wood: { text: '木局', wuxing: '木', shengStart: 330, 库: '未' },
  fire: { text: '火局', wuxing: '火', shengStart: 60, 库: '戌' },
  metal: { text: '金局', wuxing: '金', shengStart: 150, 库: '丑' },
  earth: { text: '土局', wuxing: '土', shengStart: 120, 库: '辰' }
}

/** 三合库位（生我者墓）。 */
export const KU = { water: '辰', wood: '未', fire: '戌', metal: '丑', earth: '辰' }

/** 归一到 [0, 360)。 */
export function normalize(deg) {
  const m = deg % 360
  return m < 0 ? m + 360 : m
}

/** 求方位角所属的山（每山 15°，以中心角划分）。 */
export function mountainOf(deg) {
  return MOUNTAINS[Math.round(normalize(deg) / 15) % 24]
}

/** 求方位角所属的卦宫名。 */
export function trigramOf(deg) {
  const names = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']
  return names[Math.floor(normalize(deg) / 45)]
}

export function mountainByText(text) {
  return MOUNTAINS.find((m) => m.text === text) || null
}

/** 八方（用于方位显示）。 */
export function directionName(deg) {
  const names = ['正北', '北偏东', '东北', '东偏北', '正东', '东偏南', '东南', '南偏东',
    '正南', '南偏西', '西南', '西偏南', '正西', '西偏北', '西北', '北偏西']
  return names[Math.round(normalize(deg) / 22.5) % 16]
}
