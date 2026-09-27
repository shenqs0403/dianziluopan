/**
 * 杨公三合与三元罗盘所需传统分格表。
 * 各表以正北（子位 0°）为起点、盘面顺时针展开。
 */
import { MOUNTAINS, PALACE, normalize } from './mountains.js'

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** 六十甲子。 */
export const SEXAGENARY = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])

/** 六十甲子纳音，三十组各占 12°。 */
export const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
  '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
  '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木',
  '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水'
]

/** 纳音五行：每两干一组纳音。 */
export const NAYIN_WUXING = [
  '金', '火', '木', '土', '金', '火', '水', '土', '金', '木', '水', '土',
  '火', '木', '水', '金', '火', '木', '土', '金', '火', '水', '土', '金',
  '木', '水', '土', '火', '木', '水'
]

export const WUXING_COLOR = { 木: '#2E7D32', 火: '#C62828', 土: '#8D6E3A', 金: '#B8860B', 水: '#1565C0' }
export const GROUP_COLOR = {
  木局: '#2E7D32', 火局: '#C62828', 土局: '#8D6E3A', 金局: '#B8860B', 水局: '#1565C0',
  地元: '#1565C0', 天元: '#2E2416', 人元: '#6D4C41',
  阳: '#C62828', 阴: '#2E2416'
}
export const LUCK_COLOR = { 吉: '#2E7D32', 凶: '#B3261E', 中: '#B8860B', focus: '#D98218' }

/** 五行生克：由 a 生/克 b 的关系。 */
export function wuxingRelation(a, b) {
  const sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
  const ke = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
  if (a === b) return 'same'
  if (sheng[a] === b) return 'sheng'
  if (ke[a] === b) return 'ke'
  return 'beiKe'
}

/** 后天八卦（后天为用），自子位顺时针每卦 45°。 */
export const HOUTIAN_BAGUA = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']

/** 后天八卦配洛书数。 */
export const LUOSHU_TEXT = { 坎: '一', 艮: '八', 震: '三', 巽: '四', 离: '九', 坤: '二', 兑: '七', 乾: '六' }
export const LUOSHU_NUMBER = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 乾: 6, 兑: 7, 艮: 8, 离: 9 }

/** 先天八卦（先天为体）：乾南坤北离东坎西。 */
export const XIANTIAN_BAGUA = ['坤', '震', '离', '兑', '乾', '巽', '坎', '艮']

/** 二十四节气：立春在丑艮中（315°），每气 15°。 */
export const SOLAR_TERMS = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰'
]

/** 十二次，每宫 30°。 */
export const TWELVE_CI = ['玄枵', '星纪', '析木', '大火', '寿星', '鹑尾', '鹑火', '鹑首', '实沈', '大梁', '降娄', '娵訾']

/** 十二建星：除夕建子，每宫 30°。 */
export const TWELVE_JIAN = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']

/** 六十神煞（十二神），每宫 30°。 */
export const TWELVE_SHEN = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈']

/** 二十八宿及宿度（开禧宿度），角木蛟、亢金龙…… */
export const MANSIONS = [
  ['角', 12.2], ['亢', 9.2], ['氐', 15.5], ['房', 5.5], ['心', 5.5], ['尾', 19.3], ['箕', 26.2],
  ['斗', 24.7], ['牛', 8.9], ['女', 12.2], ['虚', 10.0], ['危', 17.3], ['室', 16.0], ['壁', 8.6],
  ['奎', 16.3], ['娄', 11.8], ['胃', 15.8], ['昴', 11.3], ['毕', 16.4], ['觜', 2.4], ['参', 9.1],
  ['井', 30.7], ['鬼', 4.0], ['柳', 15.3], ['星', 7.0], ['张', 18.0], ['翼', 18.5], ['轸', 17.2]
]

/** 二十八宿五行。 */
export const MANSION_WUXING = [
  '木', '金', '土', '木', '金', '火', '水',
  '木', '金', '土', '木', '金', '火', '水',
  '木', '金', '土', '木', '金', '火', '水',
  '木', '金', '土', '木', '金', '火', '水'
]

/** 二十八宿四象吉凶：苍龙、朱雀吉；玄武、白虎凶。 */
export function mansionLuck(i) {
  return i <= 6 || i >= 21 ? '吉' : '凶'
}

/** 由宿度生成二十八宿分格（归一到 360°）。 */
export function mansionCells() {
  const total = MANSIONS.reduce((s, m) => s + m[1], 0)
  let acc = 0
  return MANSIONS.map(([name, deg], i) => {
    const startDeg = (acc / total) * 360
    acc += deg
    return { startDeg, spanDeg: (deg / total) * 360, text: name, luck: mansionLuck(i), wuxing: MANSION_WUXING[i] }
  })
}

/** 十二长生：生门起，30° 一宫，顺行。 */
export const TWELVE_STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']

/** 以生门中心角求某山在该局的十二长生。 */
export function growthStage(group, centerDeg) {
  const start = { water: 240, wood: 330, fire: 60, metal: 150, earth: 120 }[group]
  const step = Math.round(((normalize(centerDeg - start) + 360) % 360) / 30) % 12
  return TWELVE_STAGES[step]
}

/** 三元龙：每山三龙（地元/天元/人元），5° 一格共 72 格。 */
export const YUAN_LONG = ['地元', '天元', '人元']

export function yuanLongCells() {
  const cells = []
  MOUNTAINS.forEach((m, i) => {
    const three = yuanLongTriple(i)
    three.forEach((t, k) => {
      cells.push({
        startDeg: normalize(i * 15 + k * 5 - 7.5),
        spanDeg: 5,
        text: t,
        yuanLong: YUAN_LONG[k],
        mountain: m.text
      })
    })
  })
  return cells
}

/**
 * 每山的三元龙：地元龙十二支顺行（子起）、天元龙十干逆行（癸起）、
 * 人元龙十干顺行（甲起），每山三龙共 72 格。
 * 若与所用罗盘的 72 龙排布不同，只需改这里。
 */
export function yuanLongTriple(i) {
  return [BRANCHES[i % 12], STEMS[(9 - i % 10 + 10) % 10], STEMS[i % 10]]
}

/** 七十二穿山：六十干支 + 十二旬空（空亡），各 5°。 */
export const CHUAN_SHAN_72 = [...SEXAGENARY, ...BRANCHES.map((b) => `${b}空`)]

export function chuanShanCells() {
  return CHUAN_SHAN_72.map((text, i) => ({
    startDeg: i * 5,
    spanDeg: 5,
    text,
    kong: i >= 60,
    wuxing: i >= 60 ? null : NAYIN_WUXING[Math.floor(i / 2)]
  }))
}

/** 八煞黄泉：坎龙辰巳、坤兔卯辰、震猴申酉、巽鸡丑辰、乾马午未、兑蛇巳申、艮虎寅午、离猪亥子。 */
export const HUANGQUAN = { 坎: '辰巳', 艮: '寅午', 震: '申酉', 巽: '丑辰', 离: '亥子', 坤: '卯辰', 兑: '巳申', 乾: '午未' }

/** 三合八煞之劫煞：按坐山所属三合局。 */
export const JIESHA = { water: '寅', wood: '巳', earth: '巳', fire: '申', metal: '亥' }

/** 地母翻卦九星（辅星水法·消砂），按洛书宫序。 */
export const JIU_XING = { 坎: '贪狼', 坤: '巨门', 震: '禄存', 巽: '文曲', 乾: '武曲', 兑: '破军', 艮: '左辅', 离: '右弼' }
export const JIU_XING_WUXING = { 贪狼: '木', 巨门: '土', 禄存: '土', 文曲: '金', 武曲: '金', 破军: '木', 左辅: '土', 右弼: '水' }

/** 二十四天星：一太微、二天乙、三天丙、四天丁、五少微，循环至二十四。 */
export const TIAN_XING_24 = Array.from({ length: 24 }, (_, i) => ['太微', '天乙', '天丙', '天丁', '少微'][i % 5])

/** 百二十分金：每 3° 一格，一甲子领 6°。 */
export function fenJinCells(offsetDeg = 0, jiDu = false) {
  const ji = new Set(['丙', '丁', '庚', '辛'])
  return Array.from({ length: 120 }, (_, i) => {
    const center = normalize(offsetDeg + i * 3 + 1.5)
    const m = MOUNTAINS[Math.round(center / 15) % 24]
    return { startDeg: normalize(offsetDeg + i * 3), spanDeg: 3, text: SEXAGENARY[Math.floor(i / 2)], ji: jiDu && ji.has(m.text) }
  })
}

/**
 * 三元龙旺衰：60 分中每 5 分（30°）旺衰交替，阳山顺行、阴山逆行。
 * yang 为 true 时甲子起旺，false 时子午卯酉起衰。
 */
export function yuanLongQi(deg, yang) {
  const step = Math.floor(normalize(deg) / 30) % 2
  const wang = yang ? step === 0 : step !== 0
  return wang ? '旺' : '衰'
}

/** 由山取局与阴阳，供三合判读使用。 */
export function mountainGroup(mountain) {
  return { group: mountain.group, yang: mountain.yangYang, palace: PALACE[mountain.palace] }
}
