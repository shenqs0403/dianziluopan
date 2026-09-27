/**
 * 端到端交互测试：跑在真机/模拟器的 Android WebView 里，走 CDP 连过去断言。
 *
 * 它和 smoke 的分工：
 * - smoke.mjs 无浏览器，用假 ctx 断言绘制调用与数据，验证「怎么画」；
 * - 本脚本验证「点下去有没有反应」，只能对着 App 跑。
 *
 * 用法（在 web/ 下）：
 *   npm run e2e
 *
 * 依赖：adb 可用、有一台已启动的设备或模拟器。脚本会自己
 *   装 APK → pm clear（必须，否则测不到首次提示）→ 启动 → 开 CDP 转发。
 * 已经手动起好 App 时用 --no-device 跳过这步。
 *
 * 传传感器读数不靠真磁力计，直接调 window.__diZhiBridge.emit('sensor', ...)，
 * 所以结果稳定，与模拟器的实际磁场无关。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const WEB = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = dirname(WEB)
const PKG = 'com.linglongopc.dianziluopan'
const CDP = 'http://127.0.0.1:9222'

/* ---------- 设备准备 ---------- */

function findAdb() {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), 'Android/Sdk')]
  const cands = [process.env.ADB, ...sdk.filter(Boolean).map((s) => join(s, 'platform-tools/adb')), 'adb']
  for (const c of cands) {
    try {
      execFileSync(c, ['version'], { stdio: 'ignore' })
      return c
    } catch { /* 试下一个 */ }
  }
  console.error('找不到 adb：设 ADB=/path/to/adb 或把 platform-tools 加进 PATH')
  process.exit(1)
}

async function prepDevice() {
  const adb = findAdb()
  const apk = join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk')
  if (!existsSync(apk)) {
    console.error(`缺 APK：${apk}\n先跑 npm run build && npm run sync，再 gradlew :app:assembleDebug`)
    process.exit(1)
  }
  const adbRun = (...args) => execFileSync(adb, args, { stdio: 'ignore' })

  execFileSync(adb, ['install', '-r', apk], { stdio: 'ignore' })
  // 清数据是硬要求：第 1 项要测首次启动提示，上次跑完 prefs 里已记过就不会再弹
  adbRun('shell', 'am', 'force-stop', PKG)
  adbRun('shell', 'pm', 'clear', PKG)
  adbRun('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`)

  // WebView 的 devtools socket 名带 pid，得等进程起来
  let pid = ''
  for (let i = 0; i < 40 && !pid; i++) {
    await sleep(500)
    try {
      pid = execFileSync(adb, ['shell', 'pidof', PKG], { encoding: 'utf8' }).trim()
    } catch { pid = '' }
  }
  if (!pid) {
    console.error('App 没起来（pidof 拿不到 pid）')
    process.exit(1)
  }
  adbRun('forward', '--remove-all')
  adbRun('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`)

  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`${CDP}/json`)).json()
      if (list.some((t) => t.type === 'page' && t.webSocketDebuggerUrl)) return
    } catch { /* 转发还没起来 */ }
    await sleep(500)
  }
  console.error('CDP 9222 连不上，确认 WebView 可调试（setWebContentsDebuggingEnabled）')
  process.exit(1)
}

/* ---------- 设备准备必须先于 CDP 连接 ---------- */
// 顺序很关键：连接的是某个具体 WebView 的 devtools socket，
// 若先连再 force-stop/清数据，那个 WebView 会死掉，Runtime.evaluate 永不返回。
if (!process.argv.includes('--no-device')) await prepDevice()

/* ---------- CDP ---------- */

const list = await (await fetch(`${CDP}/json`)).json()
const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
if (!page) {
  console.error('没找到可调试的页面')
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params) => {
  const n = ++id
  ws.send(JSON.stringify({ id: n, method, params }))
  return new Promise((r) => pending.set(n, r))
}
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result)
    pending.delete(m.id)
  }
}
await new Promise((r) => (ws.onopen = r))
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300))
  return r.result.value
}
const ok = []
const bad = []
const check = (name, cond, extra = '') =>
  (cond ? ok : bad).push(`${cond ? '✅' : '❌'} ${name}${extra ? ' → ' + extra : ''}`)
const byText = (sel, text) =>
  `[...document.querySelectorAll('${sel}')].find(e=>e.textContent.trim().includes('${text}'))`
const degOf = (s) => parseFloat(String(s).match(/(-?[\d.]+)°/)[1])
const near = (a, b, tol) => Math.abs(a - b) <= tol
const norm360 = (d) => ((d % 360) + 360) % 360

/* ---------- 1) 首次提示 → 校对 ---------- */
check('首次运行提示显示', await evalJs(`!!${byText('.btn', '我知道了')}`))
await evalJs(`${byText('.btn', '我知道了')}.click(); true`)
await sleep(300)
check('提示关闭后出现校对遮罩', await evalJs(`!!${byText('.skip', '跳过')}`))
check('校对已开始采集', await evalJs(`/已转|画/.test(document.body.innerText)`))

// 模拟画「8」字：累计行程 >=360°、方向反转 >=2 次后应自动关闭
const sim = `(async () => {
  const t0 = Date.now();
  let a = 0, dir = 1, max = 0, seen = [];
  for (let i = 0; i < 120 && Date.now() - t0 < 8000; i++) {
    a += dir * 12; if (i % 30 === 29) dir *= -1;
    window.__diZhiBridge.emit('sensor', { azimuth: ((a % 360) + 360) % 360, pitch: 0, roll: 0, accuracy: 3 });
    const p = +(document.querySelector('.status')?.textContent.match(/(\\d+)%/) || [0, 0])[1];
    if (p > max) max = p;
    if (i % 10 === 0) seen.push(p);
    await new Promise(r => setTimeout(r, 30));
  }
  return '峰值 ' + max + '%（采样 ' + seen.join(',') + '）';
})()`
const prog = await evalJs(sim)
check('校对过程有进度反馈', /峰值 [1-9]/.test(prog), prog)
await sleep(900)
check('校对完成后遮罩自动关闭', !(await evalJs(`!!${byText('.skip', '跳过')}`)))
check('校对结果已落盘', /calibrated/.test(await evalJs(`String(window.DiZhiNative.getPrefs())`)))

/* ---------- 2) 主题 / 切盘 ---------- */
const theme = () => evalJs(`document.documentElement.dataset.theme + '|' + getComputedStyle(document.querySelector('.app')).backgroundColor + '|' + getComputedStyle(document.querySelector('.btn')).backgroundColor`)
const themeBefore = await theme()
await evalJs(`${byText('.btn', '亮色')}.click(); true`)
await sleep(300)
check('主题切换生效', themeBefore !== (await theme()), `${themeBefore} → ${await theme()}`)

await evalJs(`${byText('.btn', '简易')}.click(); true`)
await sleep(400)
const simple = await evalJs(`document.querySelector('.needle').textContent.split('、').length`)
check('简易盘为 4 环', simple === 4, '命中 ' + simple + ' 项')

/* ---------- 3) 几何：刻度带要放得下自适应字号 ---------- */
// 直接从源码读 GEO，而不是在页面里猜——带太窄字就会被切，这是本该拦住的问题
const geoSrc = readFileSync(join(WEB, 'src/dial/draw.js'), 'utf8')
const geo = geoSrc.match(/GEO\s*=\s*\{[^}]*\}/)[0]
const g = Object.fromEntries([...geo.matchAll(/(\w+):\s*([\d.]+)/g)].map((m) => [m[1], +m[2]]))
const canvasPx = await evalJs(`document.querySelector('canvas').clientWidth`)
const band = (g.ringOuter - g.dial) * canvasPx
const maxFont = Math.max(8, canvasPx * 0.018)
check('刻度带放得下自适应字号', maxFont <= band * 0.72,
  `盘宽 ${canvasPx}px，带宽 ${band.toFixed(1)}px，字号上限 ${maxFont.toFixed(1)}px`)
check('刻度带未被压到不可用', band >= 10, `带宽 ${band.toFixed(1)}px`)

/* ---------- 4) 点一次即定方位 + 坐山 + 朝山 ---------- */
await evalJs(`${byText('.btn', '三合')}.click(); true`)
await sleep(300)
const tap = (x, y) => `(() => {
  const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.36;
  const ev = (t) => c.dispatchEvent(new PointerEvent(t, { clientX: cx + ${x} * rad, clientY: cy + ${y} * rad, bubbles: true, pointerId: 1 }));
  ev('pointerdown'); ev('pointerup'); return true;
})()`
const leftHalf = () => evalJs(`(()=>{const h=document.querySelectorAll('.bottom .half')[0]
  const t=h.innerText.split('\\n').map(s=>s.trim())
  return {度数:t[1],方向:t[2],坐山:t[3].replace(/^坐山/,''),朝山:t[4].replace(/^朝山/,'')}})()`)
const rightHalf = () => evalJs(`document.querySelectorAll('.bottom .half')[1].innerText.replace(/\\s+/g,' ')`)
const rightDeg = async () => degOf(await rightHalf())

await evalJs(tap(0, -1)); await sleep(400)
const h1 = await leftHalf()
// 二十四山按「中心度数」命名（0°=子、180°=午），所以校验不变式而不是硬编码山名
check('点盘面一次即定方位+坐山+朝山',
  h1.坐山 !== '—' && h1.朝山 !== '—' && degOf(h1.度数) < 0.5,
  `${h1.度数} ${h1.方向} ${h1.坐山} ${h1.朝山}`)
// 换到正下方：方位应差 180°，且坐山/朝山正好对调
await evalJs(tap(0, 1)); await sleep(400)
const h2 = await leftHalf()
check('再点另一侧坐朝互换且方位差180',
  h2.坐山 === h1.朝山 && h2.朝山 === h1.坐山 && near(degOf(h2.度数), 180, 0.5),
  `${h2.度数} ${h2.方向} ${h2.朝山}→${h2.坐山} 与上一组对调`)
// 点方角（内盘之外）也应当作同一次拾取
const corner = `(() => {
  const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
  const o = { clientX: r.left + r.width / 2 + r.width * 0.44, clientY: r.top + r.height / 2 - r.width * 0.44, bubbles: true, pointerId: 1 };
  c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); return true;
})()`
await evalJs(corner); await sleep(400)
const h3 = await leftHalf()
check('点方角同样按相对盘心方位拾取', near(degOf(h3.度数), 45, 0.5), `${h3.度数} ${h3.方向}`)

/* ---------- 5) 点击不得影响右侧 ---------- */
const s0 = await rightHalf()
await evalJs(tap(0, -1)); await sleep(400)
const s1 = await rightHalf()
await evalJs(tap(0, 1)); await sleep(400)
const s2 = await rightHalf()
check('点盘面不改变右侧陀螺仪南向', s0 === s1 && s1 === s2, s2.slice(0, 60))

/* ---------- 6) 转动内盘：右侧跟着转，且点击改按盘面角拾取 ---------- */
// 右侧 = 红针在转过来的盘面上的读数，所以转 +60° 它应该正好 -60°。
// 传感器静止，全程只有盘面旋转这一个变量。
const drag = (deg) => `(async () => {
  const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.36;
  const a0 = -Math.PI / 2, a1 = a0 + ${deg} * Math.PI / 180;
  const mk = (a) => ({ clientX: cx + Math.cos(a) * rad, clientY: cy + Math.sin(a) * rad, bubbles: true, pointerId: 1 });
  c.dispatchEvent(new PointerEvent('pointerdown', mk(a0)));
  for (let i = 1; i <= 12; i++) { c.dispatchEvent(new PointerEvent('pointermove', mk(a0 + (a1 - a0) * i / 12))); await new Promise(r => setTimeout(r, 16)); }
  c.dispatchEvent(new PointerEvent('pointerup', mk(a1)));
  await new Promise(r => setTimeout(r, 250));
  return true;
})()`
const rBefore = await rightDeg()
await evalJs(drag(60)); await sleep(400)
const rAfter = await rightDeg()
// 盘面转了多少，可以从右侧读数的变化反推，不用去猜内部状态
const turned = norm360(rBefore - rAfter)
check('转动内盘时右侧跟着指盘面', near(turned, 60, 1), `转了 ${turned.toFixed(1)}°，右侧 ${rBefore.toFixed(1)}° → ${rAfter.toFixed(1)}°`)
// 圈转过之后，点屏幕正上方（屏幕角 0°）拿到的应是盘面角 -turned，而不是 0
await evalJs(tap(0, -1)); await sleep(400)
const h4 = await leftHalf()
check('转动后点击按盘面角拾取', near(degOf(h4.度数), norm360(-turned), 1),
  `屏幕正上方 0° 拾到盘面 ${h4.度数}（盘面已转 ${turned.toFixed(1)}°）`)

/* ---------- 7) 拖拽后指针命中内容变化 ---------- */
const hitBefore = await evalJs(`document.querySelector('.needle').textContent`)
await evalJs(drag(90)); await sleep(400)
const hitAfter = await evalJs(`document.querySelector('.needle').textContent`)
check('拖拽后指针命中内容随之变化', hitBefore !== hitAfter,
  `${hitBefore.slice(0, 30)} → ${hitAfter.slice(0, 30)}`)

/* ---------- 8) 天心十字线像素校验 ---------- */
const px = await evalJs(`(() => {
  const c = document.querySelector('canvas'), ctx = c.getContext('2d');
  const s = c.width, d = ctx.getImageData(0, 0, s, s).data;
  const at = (x, y) => { const i = (y * s + x) * 4; return [d[i], d[i+1], d[i+2]]; };
  const mid = Math.floor(s / 2);
  return {
    上: at(mid, Math.floor(s * 0.03)), 下: at(mid, Math.floor(s * 0.97)),
    左: at(Math.floor(s * 0.03), mid), 右: at(Math.floor(s * 0.97), mid),
    角: at(Math.floor(s * 0.05), Math.floor(s * 0.05))
  };
})()`)
const isRed = (c) => c[0] > 150 && c[1] < 110 && c[2] < 110
check('天心十字线贯穿四边', ['上', '下', '左', '右'].every((k) => isRed(px[k])), JSON.stringify(px))

ws.close()
console.log(ok.join('\n'))
if (bad.length) {
  console.log('\n' + bad.join('\n'))
  process.exitCode = 1
} else {
  console.log(`\n全部 ${ok.length} 项通过`)
}
