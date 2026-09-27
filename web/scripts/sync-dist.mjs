/**
 * 把 web/dist 同步到原生工程的资源目录（工程目录不存在则跳过）。
 *
 *   npm run sync                 只同步 Android（当前只做 Android 版）
 *   npm run sync -- ios harmony  追加同步其它端
 *
 * Android: android/app/src/main/assets/www        → file:///android_asset/www/index.html
 * iOS:     ios/www                                → Bundle/www/index.html
 * 鸿蒙:     harmony/entry/src/main/resources/rawfile/www → $rawfile('www/index.html')
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

const ALL = {
  android: '../android/app/src/main/assets/www',
  ios: '../ios/www',
  harmony: '../harmony/entry/src/main/resources/rawfile/www'
}

const wanted = process.argv.slice(2).filter((a) => ALL[a])
const targets = (wanted.length ? wanted : ['android']).map((name) => [name, ALL[name]])

let done = 0
for (const [name, t] of targets) {
  const proj = resolve(root, '..', name)
  if (!existsSync(proj)) {
    console.log(`跳过（工程未创建）：${name}`)
    continue
  }
  const dest = resolve(root, t)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(dist, dest, { recursive: true })
  console.log(`已同步：${name} → ${t}`)
  done += 1
}
console.log(`完成，共 ${done} 个目标`)
