/**
 * 跨端桥接契约校验。
 *
 * 关键点：「原生必须实现哪些方法」不是手抄的清单，而是**把各端 JS 适配器
 * 真正跑一遍**，用探针对象记录它访问了原生的哪些成员。这样前端加方法、
 * 或者某端适配器改用本地存储，契约检查会立刻发现原生端漏实现。
 *
 * 检查项：
 *   1. 适配器委派给原生的方法集合 ⊆ 原生源码实际提供的成员
 *      （iOS 走 postMessage 的 type，比对 Swift 的 case）
 *   2. 原生 → JS 的出口 window.__diZhiBridge.emit(...) 与 'sensor' 字面量存在
 *   3. 注入对象名 DiZhiNative（iOS 是 handler 名 dianzhi）一致
 *   4. getPrefs 必须是同步实现（loadPrefs 拿到返回值就 JSON.parse）
 *   5. 鸿蒙/快应用设置了 __platform，让 detect() 不靠 UA 猜
 *
 * 用法：node scripts/contract-check.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAndroidAdapter } from '../src/platform/android.js'
import { createIosAdapter } from '../src/platform/ios.js'
import { createHarmonyAdapter } from '../src/platform/harmony.js'
import { createQuickAppAdapter } from '../src/platform/quickapp.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(root, '..')

const FACTORIES = {
  android: createAndroidAdapter,
  ios: createIosAdapter,
  harmony: createHarmonyAdapter,
  quickapp: createQuickAppAdapter
}

// 注入名 / iOS 的 handler 名
const GLOBAL = { android: 'DiZhiNative', ios: 'dianzhi', harmony: 'DiZhiNative', quickapp: 'DiZhiNative' }

const FILES = {
  android: [
    'android/app/src/main/java/com/linglongopc/dianziluopan/DiZhiNative.kt',
    'android/app/src/main/java/com/linglongopc/dianziluopan/MainActivity.kt'
  ],
  ios: [
    'ios/DiZhi/Bridge.swift',
    'ios/DiZhi/DialViewController.swift',
    'ios/DiZhi/AppDelegate.swift'
  ],
  harmony: [
    'harmony/entry/src/main/ets/common/DiZhiNative.ets',
    'harmony/entry/src/main/ets/pages/Index.ets'
  ],
  quickapp: ['harmony/quickapp/src/common/bridge.ux', 'harmony/quickapp/src/pages/index/index.ux']
}

const problems = []
const notes = []
const fail = (m) => problems.push(m)
const note = (m) => notes.push(m)

// ---------------------------------------------------------------- 探针

/** 记录适配器在原生对象上访问了哪些成员，并让它们都可调用。 */
function makeNativeSpy(methods) {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        // __platform 是给 detect() 用的标记，不是方法
        if (typeof prop !== 'string' || prop === '__platform') return undefined
        methods.add(prop)
        // 返回函数，适配器里的 `native?.x?.()` 才不会短路
        return () => undefined
      }
    }
  )
}

/** 模拟 iOS 的 window.webkit.messageHandlers.dianzhi 与 localStorage。 */
function setupIosWindow(calls) {
  const store = {}
  globalThis.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v)
      }
    },
    webkit: { messageHandlers: { dianzhi: { postMessage: (m) => calls.push(m) } } }
  }
}

/** platform/index.js 暴露给界面的能力（close 不在其中，device 没转发它） */
const API = ['startSensors', 'stopSensors', 'setTheme', 'vibrate', 'keepScreenOn', 'getPrefs', 'setPrefs']

/** 跑一遍适配器，返回它委派给原生的成员名。 */
function probeDelegated(platform) {
  const methods = new Set()
  const calls = []
  const factory = FACTORIES[platform]
  let adapter
  if (platform === 'ios') {
    setupIosWindow(calls)
    adapter = factory()
  } else {
    adapter = factory(makeNativeSpy(methods))
  }
  for (const name of API) {
    try {
      adapter[name](name === 'vibrate' || name === 'setPrefs' ? 30 : true)
    } catch (e) {
      fail(`[${platform}] 适配器调用 ${name}() 抛错：${e.message}`)
    }
  }
  return { methods, calls }
}

// ---------------------------------------------------------------- 读源码

const src = {}
for (const [name, files] of Object.entries(FILES)) {
  let all = ''
  for (const f of files) {
    const p = resolve(repo, f)
    if (!existsSync(p)) {
      fail(`[${name}] 找不到文件：${f}`)
      continue
    }
    all += readFileSync(p, 'utf8') + '\n'
  }
  src[name] = all
}

/** 在源码里找成员声明，兼容 Kotlin / Swift / ArkTS / JS 的写法。 */
function declares(text, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // ArkTS/TS 成员可能带 public/private/static/async/override/get 等修饰词
  const mods = '(?:(?:public|private|protected|static|async|override|readonly)\\s+)*'
  return [
    new RegExp(`\\bfun\\s+${esc}\\s*\\(`), // Kotlin
    new RegExp(`\\bfunc\\s+${esc}\\s*\\(`), // Swift
    new RegExp(`^\\s*${mods}${esc}\\s*[:(]`, 'm'), // ArkTS class 成员 / 对象字面量属性
    new RegExp(`\\b${esc}\\s*[:=]\\s*(async\\s+)?function\\s*\\(`), // 对象属性函数
    new RegExp(`case\\s+['"]${esc}['"]`) // Swift switch
  ].some((re) => re.test(text))
}

// ---------------------------------------------------------------- 逐端校验

for (const platform of Object.keys(FILES)) {
  const text = src[platform]
  const { methods, calls } = probeDelegated(platform)

  if (platform === 'ios') {
    // iOS 的「方法名」就是 postMessage 的 type
    const types = new Set(calls.map((c) => c && c.type).filter(Boolean))
    if (!types.size) fail('[ios] 没记录到任何 postMessage type，适配器结构可能变了')
    for (const t of types) {
      if (!declares(text, t)) fail(`[ios] Bridge.swift 缺少 case "${t}"`)
    }
    note(`ios：postMessage 发出 ${types.size} 个 type → ${[...types].join(', ')}`)
    // iOS 的 getPrefs/setPrefs 走 localStorage，桥里本来就不该有
    if (declares(text, 'getPrefs')) {
      fail('[ios] ios.js 用 localStorage 做 prefs，Bridge.swift 不该再实现 getPrefs（会误导后来人）')
    } else {
      note('ios：getPrefs/setPrefs 由 localStorage 实现，Bridge.swift 不实现（与适配器一致）')
    }
  } else {
    if (!methods.size) fail(`[${platform}] 没记录到任何原生方法，适配器结构可能变了`)
    for (const m of methods) {
      if (!declares(text, m)) fail(`[${platform}] 原生侧缺少方法 ${m}()`)
    }
    note(`${platform}：适配器委派 ${methods.size} 个方法 → ${[...methods].join(', ')}`)
  }

  // ---- 公共检查 ----
  if (!text) continue
  if (!text.includes('__diZhiBridge')) {
    fail(`[${platform}] 原生侧没有 __diZhiBridge，JS 收不到传感器推送`)
  }
  if (!/\.emit\(/.test(text)) {
    fail(`[${platform}] 原生侧没有 .emit( 调用`)
  }
  if (!/['"]sensor['"]/.test(text)) {
    fail(`[${platform}] 原生侧没有 'sensor' 事件字面量`)
  }
  if (!text.includes(GLOBAL[platform])) {
    fail(`[${platform}] 原生侧没有出现注入名/handler 名 ${GLOBAL[platform]}`)
  }
  // getPrefs 必须同步：loadPrefs() 拿到返回值就 JSON.parse
  const m = text.match(/^[^\S\n]*((?:async|suspend)\s+)?getPrefs[^\n]*/m)
  if (m && (m[1] || /Promise|:\s*Promise/.test(m[0]))) {
    fail(`[${platform}] getPrefs 不能异步，loadPrefs() 会拿不到字符串：${m[0].trim()}`)
  }
}

// detect() 优先看 native.__platform；javaScriptProxy 白名单不暴露普通属性，
// 必须在页面侧显式打标记，否则只能靠 UA 猜。
for (const platform of ['harmony', 'quickapp']) {
  if (!src[platform].includes('__platform')) {
    fail(`[${platform}] 没有设置 __platform，detect() 会退化成靠 UA 猜平台`)
  } else if (!src[platform].includes("'quickapp'") && !src[platform].includes('"quickapp"')) {
    note(`${platform}：__platform 标记已设置`)
  }
}

// ---------------------------------------------------------------- 配置校验
// 本机没有 DevEco/Hvigor，编译不了鸿蒙工程，所以至少把配置文件的语法错误
// 在这里拦住：resource 下的 .json 必须是严格 JSON（不能有注释），
// 工程配置是 .json5（可以有注释和无引号键）。

/** 够用的 JSON5 子集解析：去注释 → 补引号 → 去尾逗号。 */
function parseJson5ish(text) {
  let s = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(s)
}

const JSON_CONFIGS = [
  'harmony/entry/src/main/resources/base/element/color.json',
  'harmony/entry/src/main/resources/base/element/string.json',
  'harmony/entry/src/main/resources/base/profile/main_pages.json',
  'harmony/AppScope/resources/base/element/string.json',
  'harmony/quickapp/manifest.json',
  'harmony/quickapp/package.json'
]
const JSON5_CONFIGS = [
  'harmony/build-profile.json5',
  'harmony/oh-package.json5',
  'harmony/AppScope/app.json5',
  'harmony/entry/build-profile.json5',
  'harmony/entry/oh-package.json5',
  'harmony/entry/src/main/module.json5'
]

for (const f of JSON_CONFIGS) {
  const p = resolve(repo, f)
  if (!existsSync(p)) {
    fail(`缺少配置文件：${f}`)
    continue
  }
  const text = readFileSync(p, 'utf8')
  try {
    JSON.parse(text)
  } catch (e) {
    // 资源 .json 里的 // 注释是这类工程最常见的翻车点，单独提示
    const hint = /\/\//.test(text) ? '（含 // 注释：ArkUI 资源的 .json 不允许注释）' : ''
    fail(`${f} 不是合法 JSON：${e.message}${hint}`)
  }
}
for (const f of JSON5_CONFIGS) {
  const p = resolve(repo, f)
  if (!existsSync(p)) {
    fail(`缺少配置文件：${f}`)
    continue
  }
  try {
    parseJson5ish(readFileSync(p, 'utf8'))
  } catch (e) {
    fail(`${f} 不是合法 JSON5：${e.message}`)
  }
}
note(`配置语法：${JSON_CONFIGS.length} 个 .json + ${JSON5_CONFIGS.length} 个 .json5 已校验`)

// ---------------------------------------------------------------- 输出

console.log('跨端桥接契约检查')
console.log('─'.repeat(48))
for (const n of notes) console.log(`  · ${n}`)
if (problems.length) {
  console.log('─'.repeat(48))
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n契约检查未通过：${problems.length} 个问题`)
  process.exit(1)
}
console.log('─'.repeat(48))
console.log('  ✓ 全部通过')
