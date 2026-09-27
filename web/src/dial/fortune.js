/**
 * 吉凶判读：三合 / 三元 / 综合 / 简易四种口径，另含随方位变化的单点吉凶。
 * 判读只输出一条结论，与旧版罗盘界面保持一致。
 */
import { GROUPS, KU, MOUNTAINS, PALACE, mountainOf, normalize } from './mountains.js'
import { growthStage, LUOSHU_NUMBER, yuanLongQi } from './tables.js'

const SANHE_GRADE = {
  旺山旺向: { score: 100, text: '旺山旺向' },
  上山下水: { score: 90, text: '上山下水' },
  双山双立: { score: 80, text: '双山双立' },
  下山下水: { score: 70, text: '下山下水' },
  山旺向衰: { score: 60, text: '山旺向衰' },
  山衰向旺: { score: 50, text: '山衰向旺' },
  上山向水: { score: 40, text: '上山向水' },
  下山向上: { score: 30, text: '下山向上' }
}

/**
 * 三合判读：同局同阴阳为净，依向山在坐山局中的十二长生定八格。
 */
export function judgeSanhe(sitting, facing) {
  if (!sitting || !facing) return null
  const sameGroup = sitting.group === facing.group
  const sameYang = sitting.yangYang === facing.yangYang
  const stage = growthStage(sitting.group, facing.centerDeg)
  let name
  if (sameGroup && sameYang) {
    if (stage === '帝旺' || stage === '临官') name = '旺山旺向'
    else if (stage === '沐浴' || stage === '衰') name = '上山下水'
    else if (stage === '冠带' || stage === '病') name = '双山双立'
    else name = '下山下水'
  } else if (sameGroup) {
    name = sitting.yangYang ? '山衰向旺' : '山旺向衰'
  } else {
    name = sitting.group === 'earth' || facing.group === 'earth' ? '下山向上' : '上山向水'
  }
  const grade = SANHE_GRADE[name]
  return {
    name: `${grade.text}·${GROUPS[sitting.group].text}`,
    score: grade.score,
    detail: `坐${sitting.text}向${facing.text}｜坐山${GROUPS[sitting.group].text}、向山十二长生为${stage}｜${sameGroup && sameYang ? '同局同阴阳为净' : sameGroup ? '同局异阴阳为浊' : '异局'}`
  }
}

/**
 * 三元判读：坐山、向山各取三元龙 60 分旺衰，阳顺阴逆。
 */
export function judgeSanyuan(sitting, facing) {
  if (!sitting || !facing) return null
  const qiOf = (m) => (yuanLongQi(m.centerDeg, m.yangYang) === '旺' ? '旺' : '衰')
  const sQi = qiOf(sitting)
  const fQi = qiOf(facing)
  let name
  let score
  if (sQi === '旺' && fQi === '旺') { name = '旺山旺向'; score = 100 } else if (sQi === '旺' && fQi === '衰') { name = '上山下水'; score = 85 } else if (sQi === '衰' && fQi === '旺') { name = '下山上水'; score = 60 } else { name = '双山双衰'; score = 40 }
  const sameYang = sitting.yangYang === facing.yangYang
  return {
    name: `${name}·${sameYang ? '净' : '浊'}`,
    score,
    detail: `坐${sitting.text}（${sQi}）向${facing.text}（${fQi}）｜60 分阳顺阴逆`
  }
}

/** 简易判读：只看同局、阴阳与库位。 */
export function judgeSimple(sitting, facing) {
  if (!sitting || !facing) return null
  const sameGroup = sitting.group === facing.group
  const sameYang = sitting.yangYang === facing.yangYang
  const facingKu = KU[facing.group] === facing.text
  const name = sameGroup && sameYang ? '同局同阴阳' : sameGroup ? '同局异阴阳' : facingKu ? '异局向为库' : '异局'
  const score = sameGroup && sameYang ? 90 : sameGroup ? 60 : facingKu ? 40 : 30
  return {
    name: `${name}·${GROUPS[sitting.group].text}`,
    score,
    detail: `坐${sitting.text}向${facing.text}｜${facingKu ? '向山为本局库位' : '向山非库位'}`
  }
}

/** 按罗盘类型判读，取一条结论。 */
export function judge(type, sitting, facing) {
  const sanhe = judgeSanhe(sitting, facing)
  const sanyuan = judgeSanyuan(sitting, facing)
  if (!sanhe) return null
  if (type === 'sanyuan') return sanyuan
  if (type === 'simple') return judgeSimple(sitting, facing)
  if (type === 'sanhe') return sanhe
  // 综合：两法折中
  const score = Math.round((sanhe.score + sanyuan.score) / 2)
  const better = sanhe.score >= sanyuan.score ? sanhe : sanyuan
  return {
    name: `${better.name}（综合 ${score}）`,
    score,
    detail: `三合：${sanhe.name}｜三元：${sanyuan.name}`
  }
}

/**
 * 随方位变化的单点吉凶：十二长生 + 三元旺衰 + 洛书数。
 */
export function azimuthLuck(sitting, deg) {
  const m = mountainOf(deg)
  const group = sitting ? sitting.group : 'water'
  const stage = growthStage(group, m.centerDeg)
  const qi = yuanLongQi(m.centerDeg, m.yangYang)
  const luoshu = LUOSHU_NUMBER[PALACE[MOUNTAINS[Math.round(m.centerDeg / 15) % 24].palace].trigram]
  const good = stage === '帝旺' || stage === '临官' || stage === '长生'
  const bad = stage === '死' || stage === '病' || stage === '墓'
  const luck = good ? '吉' : bad ? '凶' : '中'
  const why = good ? '生旺' : bad ? '死墓' : '平和'
  return {
    mountain: m, stage, qi, luoshu, luck,
    text: `${m.text}·${stage}·${qi}`,
    note: `${GROUPS[group].text}坐山，此向十二长生为${stage}（${why}）；三元${qi}，洛书 ${luoshu}`
  }
}

export { normalize }
