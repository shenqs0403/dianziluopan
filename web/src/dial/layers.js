/**
 * 四种罗盘（简易 / 三元 / 三合 / 综合）的内盘分层定义。
 * 每层由若干分格组成，分格统一为 { startDeg, spanDeg, text, color, luck }。
 * layers 数组顺序为「由外到内」，第一个画在最外圈。
 */
import { MOUNTAINS, PALACE, normalize, GROUPS } from './mountains.js'
import {
  HOUTIAN_BAGUA, XIANTIAN_BAGUA, LUOSHU_TEXT, LUOSHU_NUMBER, SOLAR_TERMS, TWELVE_CI,
  TWELVE_JIAN, TWELVE_SHEN, mansionCells, MANSION_WUXING, HUANGQUAN, JIESHA, JIU_XING,
  JIU_XING_WUXING, TIAN_XING_24, SEXAGENARY, NAYIN_WUXING, WUXING_COLOR, GROUP_COLOR,
  LUCK_COLOR, chuanShanCells, yuanLongCells, fenJinCells, growthStage
} from './tables.js'

const REN_OFFSET = -7.5
const TIAN_OFFSET = 7.5

/** 由「名称 + 格宽」序列生成均分分格。 */
function uniform(names, spanDeg, startDeg = 0, colorOf = null, textOf = null) {
  return names.map((name, i) => ({
    startDeg: normalize(startDeg + i * spanDeg),
    spanDeg,
    text: textOf ? textOf(i, name) : name,
    color: colorOf ? colorOf(i, name) : null,
    luck: null
  }))
}

/** 二十四山分格（红黑阴阳龙）。 */
function mountainCells(offset = 0, colorOf = null, textOf = (m) => m.text) {
  return MOUNTAINS.map((m) => ({
    startDeg: normalize(m.centerDeg - 7.5 + offset),
    spanDeg: 15,
    text: textOf(m),
    color: colorOf ? colorOf(m) : null
  }))
}

/** 宫色（八卦五行）。 */
function palaceColor(palace) {
  return WUXING_COLOR[{ 坎: '水', 艮: '土', 震: '木', 巽: '木', 离: '火', 坤: '土', 兑: '金', 乾: '金' }[palace]]
}

/** 二十八宿分格。 */
function mansionRing(keyOf) {
  return mansionCells().map((c) => {
    const w = keyOf(c)
    return { startDeg: c.startDeg, spanDeg: c.spanDeg, text: w.text, color: w.color, luck: w.luck || null }
  })
}

const W360 = () => ({
  key: 'w360',
  title: '周天刻度',
  cells: uniform(Array.from({ length: 24 }, (_, i) => i * 15), 15, 0, null, (i) => String(i * 15)),
  ticks: { minor: 1, major: 5 }
})

const HOU_TIAN = (title = '后天八卦') => ({
  key: 'hou_tian',
  title,
  cells: uniform(HOUTIAN_BAGUA, 45, -22.5, (i, n) => palaceColor(n), (i, n) => `${n}${LUOSHU_TEXT[n]}`),
  ticks: { major: 5 }
})

const XIAN_TIAN = () => ({
  key: 'xian_tian',
  title: '先天八卦',
  cells: uniform(XIANTIAN_BAGUA, 45, -22.5, (i, n) => palaceColor(n)),
  ticks: { major: 5 }
})

const DI_PAN = () => ({
  key: 'di_pan',
  title: '地盘正针',
  cells: mountainCells(0, (m) => GROUP_COLOR[m.yangYang ? '阳' : '阴']),
  ticks: { minor: 1, major: 5 }
})

const DI_PAN_FEN_JIN = () => ({
  key: 'di_pan_fen_jin',
  title: '正针分金',
  cells: fenJinCells(0, true).map((c) => ({ ...c, color: c.ji ? LUCK_COLOR['吉'] : null, luck: c.ji ? '吉' : null }))
})

const TIAN_PAN = () => ({
  key: 'tian_pan',
  title: '天盘缝针',
  cells: mountainCells(TIAN_OFFSET),
  ticks: { minor: 1 }
})

const REN_PAN = () => ({
  key: 'ren_pan',
  title: '人盘中针',
  cells: mountainCells(REN_OFFSET, (m) => GROUP_COLOR[GROUPS[m.group].text]),
  ticks: { minor: 1 }
})

const TIAN_PAN_FEN_JIN = () => ({
  key: 'tian_pan_fen_jin',
  title: '天盘分金',
  cells: fenJinCells(TIAN_OFFSET).map((c) => ({ ...c, color: null }))
})

const REN_PAN_FEN_JIN = () => ({
  key: 'ren_pan_fen_jin',
  title: '人盘分金',
  cells: fenJinCells(REN_OFFSET).map((c) => ({ ...c, color: null }))
})

const TOU_DI = () => ({
  key: 'tou_di',
  title: '透地六十龙',
  cells: uniform(SEXAGENARY, 6, 0, (i, n) => GROUP_COLOR[groupTextOf(n)]),
  ticks: { minor: 1 }
})

function groupTextOf(ganzhi) {
  const b = ganzhi[1]
  return { 申: '水局', 子: '水局', 亥: '木局', 卯: '木局', 寅: '火局', 午: '火局', 巳: '金局', 酉: '金局', 辰: '土局', 戌: '土局', 丑: '土局', 未: '土局' }[b]
}

const GUA_YUN = () => ({
  key: 'gua_yun',
  title: '六十龙卦运',
  cells: uniform(SEXAGENARY, 6, 0, null, (i, g) => String(LUOSHU_NUMBER[palaceOfBranch(g[1])]))
})

function palaceOfBranch(b) {
  return { 子: '坎', 丑: '艮', 寅: '震', 卯: '震', 辰: '艮', 巳: '巽', 午: '离', 未: '坤', 申: '坤', 酉: '兑', 戌: '乾', 亥: '乾' }[b]
}

const CHUAN_SHAN = () => ({
  key: 'chuan_shan',
  title: '穿山七十二龙',
  cells: chuanShanCells().map((c) => ({ ...c, color: c.kong ? LUCK_COLOR['凶'] : null, luck: c.kong ? '凶' : null })),
  ticks: { minor: 1 }
})

const CHUAN_SHAN_NAYIN = () => ({
  key: 'chuan_shan_nayin',
  title: '七十二龙纳音',
  cells: chuanShanCells().map((c) => ({
    startDeg: c.startDeg,
    spanDeg: 5,
    text: c.kong ? '空' : c.wuxing,
    color: c.kong ? LUCK_COLOR['凶'] : WUXING_COLOR[c.wuxing],
    luck: c.kong ? '凶' : null
  }))
})

const YUAN_LONG_72 = () => ({
  key: 'yuan_long',
  title: '三元龙',
  cells: yuanLongCells().map((c) => ({
    startDeg: c.startDeg,
    spanDeg: 5,
    text: `${c.text}`,
    color: GROUP_COLOR[({ 地元: '地元', 天元: '天元', 人元: '人元' })[c.yuanLong]],
    yuanLong: c.yuanLong,
    mountain: c.mountain
  })),
  ticks: { minor: 1 }
})

const HUANG_QUAN = () => ({
  key: 'huang_quan',
  title: '八煞黄泉',
  cells: mountainCells(0, () => LUCK_COLOR['凶'], (m) => HUANGQUAN[PALACE[m.palace].trigram])
})

const JIE_SHA = (sitting) => {
  const target = JIESHA[sitting ? sitting.group : 'water']
  return {
    key: 'jie_sha',
    title: '劫煞',
    cells: mountainCells(0, (m) => (m.text === target ? LUCK_COLOR['凶'] : null), (m) => (m.text === target ? '劫煞' : m.text)),
    focus: target
  }
}

const JIU_XING_RING = () => ({
  key: 'jiu_xing',
  title: '地母翻卦九星',
  cells: mountainCells(0, (m) => WUXING_COLOR[JIU_XING_WUXING[JIU_XING[PALACE[m.palace].trigram]]], (m) => JIU_XING[PALACE[m.palace].trigram])
})

const TWELVE_GROWTH = (sitting) => {
  const group = sitting ? sitting.group : 'water'
  return {
    key: 'twelve_growth',
    title: '十二长生',
    group,
    cells: uniform(
      Array.from({ length: 12 }, (_, i) => i),
      30,
      -15,
      (i) => (i === 0 || i === 4 ? LUCK_COLOR['吉'] : i === 8 ? null : null),
      (i) => growthStage(group, i * 30)
    )
  }
}

const MANSIONS = () => ({ key: 'lunar_mansions', title: '二十八宿', cells: mansionRing((c) => ({ text: c.text })), ticks: { major: 5 } })
const MANSION_WUXING_RING = () => ({
  key: 'mansion_wuxing',
  title: '二十八宿五行',
  cells: mansionRing((c) => ({ text: c.wuxing, color: WUXING_COLOR[c.wuxing] }))
})
const MANSION_LUCK_RING = () => ({
  key: 'mansion_luck',
  title: '二十八宿吉凶',
  cells: mansionRing((c) => ({ text: c.luck, color: LUCK_COLOR[c.luck], luck: c.luck }))
})
const HUN_TIAN = () => ({ key: 'hun_tian', title: '浑天星度', cells: mansionRing((c) => ({ text: c.text })) })
const HUN_TIAN_WUXING = () => ({
  key: 'hun_tian_wuxing',
  title: '浑天星度五行',
  cells: mansionRing((c) => ({ text: c.wuxing, color: WUXING_COLOR[c.wuxing] }))
})

const TIAN_XING = () => ({ key: 'tian_xing_24', title: '二十四天星', cells: uniform(TIAN_XING_24, 15, -7.5) })

const SOLAR_TERMS_RING = () => ({ key: 'solar_terms', title: '二十四节气', cells: uniform(SOLAR_TERMS, 15) })
const TWELVE_CI_RING = () => ({ key: 'twelve_ci', title: '十二次', cells: uniform(TWELVE_CI, 30) })
const TWELVE_JIAN_RING = () => ({ key: 'twelve_jian', title: '十二建星', cells: uniform(TWELVE_JIAN, 30) })
const TWELVE_SHEN_RING = () => ({ key: 'twelve_shen', title: '六十神煞', cells: uniform(TWELVE_SHEN, 30) })
const NAYIN_WUXING_RING = () => ({
  key: 'nayin_wuxing',
  title: '纳音五行',
  cells: uniform(Array.from({ length: 30 }, (_, i) => i), 12, 0, (i) => WUXING_COLOR[NAYIN_WUXING[i]], (i) => NAYIN_WUXING[i])
})

/** 四种罗盘的分层。sitting 变化时需要重新构建（十二长生、劫煞随局变动）。 */
export function buildLayers(type, sitting) {
  switch (type) {
    case 'simple':
      return [W360(), HOU_TIAN('后天八卦'), DI_PAN(), TWELVE_GROWTH(sitting)]
    case 'sanyuan':
      return [
        W360(), TIAN_XING(), MANSION_WUXING_RING(), MANSIONS(), SOLAR_TERMS_RING(), TWELVE_CI_RING(),
        TWELVE_JIAN_RING(), TWELVE_SHEN_RING(), TOU_DI(), CHUAN_SHAN(), YUAN_LONG_72(), DI_PAN(),
        REN_PAN(), TIAN_PAN(), TWELVE_GROWTH(sitting), HOU_TIAN()
      ]
    case 'sanhe':
      return [
        W360(), TIAN_XING(), MANSION_WUXING_RING(), MANSION_LUCK_RING(), MANSIONS(), HUN_TIAN_WUXING(),
        HUN_TIAN(), TIAN_PAN_FEN_JIN(), TIAN_PAN(), DI_PAN_FEN_JIN(), GUA_YUN(), TOU_DI(),
        REN_PAN_FEN_JIN(), REN_PAN(), JIU_XING_RING(), CHUAN_SHAN_NAYIN(), CHUAN_SHAN(), DI_PAN(),
        JIE_SHA(sitting), HUANG_QUAN(), HOU_TIAN('后天八卦（洛书）'), XIAN_TIAN()
      ]
    case 'combined':
    default:
      return [
        W360(), TIAN_XING(), MANSIONS(), SOLAR_TERMS_RING(), MANSION_LUCK_RING(), TOU_DI(), GUA_YUN(),
        CHUAN_SHAN(), CHUAN_SHAN_NAYIN(), YUAN_LONG_72(), DI_PAN(), DI_PAN_FEN_JIN(), REN_PAN(),
        TIAN_PAN(), HUANG_QUAN(), JIE_SHA(sitting), TWELVE_GROWTH(sitting), JIU_XING_RING(), HOU_TIAN(), XIAN_TIAN()
      ]
  }
}

export const DIAL_TYPES = [
  { key: 'sanhe', text: '三合' },
  { key: 'sanyuan', text: '三元' },
  { key: 'combined', text: '综合' },
  { key: 'simple', text: '简易' }
]
