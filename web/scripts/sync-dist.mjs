/**
 * 把 web/dist 同步到各原生工程的资源目录（工程目录不存在则跳过）。
 *
 *   npm run sync                              只同步 Android
 *   npm run sync -- ios harmony quickapp      追加同步其它端
 *
 * Android: android/app/src/main/assets/www              → file:///android_asset/www/index.html
 * iOS:     ios/www                                      → Bundle/www/index.html
 * 鸿蒙:     harmony/entry/src/main/resources/rawfile/www → $rawfile('www/index.html')
 * 快应用:   harmony/quickapp/src/www                     → ./www/index.html
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
if (!existsSync(dist)) {
  console.error('请先执行 npm run build')
  process.exit(1)
}

const repo = resolve(root, '..')

// probe 是判断「该端工程是否已创建」的依据，必须显式写出来：
// quickapp 挂在 harmony/ 下面，不能用目标名去拼工程目录。
const ALL = {
  android: { probe: 'android', dest: 'android/app/src/main/assets/www' },
  ios: { probe: 'ios', dest: 'ios/www' },
  harmony: { probe: 'harmony/entry', dest: 'harmony/entry/src/main/resources/rawfile/www' },
  quickapp: { probe: 'harmony/quickapp', dest: 'harmony/quickapp/src/www' }
}

const wanted = process.argv.slice(2).filter((a) => ALL[a])
for (const a of process.argv.slice(2)) {
  if (!ALL[a]) {
    console.warn(`忽略未知目标：${a}（可用：${Object.keys(ALL).join(' / ')}）`)
  }
}
const targets = (wanted.length ? wanted : ['android']).map((name) => [name, ALL[name]])

let done = 0
for (const [name, t] of targets) {
  if (!existsSync(resolve(repo, t.probe))) {
    console.log(`跳过（工程未创建）：${name}`)
    continue
  }
  const dest = resolve(repo, t.dest)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(dist, dest, { recursive: true })
  console.log(`已同步：${name} → ${t.dest}`)
  done += 1
}
console.log(`完成，共 ${done} 个目标`)
