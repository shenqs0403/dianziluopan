/**
 * 把 dist/assets 里的 CSS、JS 内联进 dist/index.html，并删掉 assets 目录，
 * 让最终产物只有一个 index.html。
 *
 * 原因：ES module(<script type="module">) 在 file:// 协议下会被 Chromium/WebView
 * 按 CORS 拦掉，Android 直接加载 assets/www/index.html 时界面会是空白。
 * 单文件内联后原生侧只需拷贝一个 html，四端通用。
 */
import { readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const htmlPath = join(dist, 'index.html')

if (!existsSync(htmlPath)) {
  console.error('请先执行 vite build')
  process.exit(1)
}

let html = readFileSync(htmlPath, 'utf8')

const refs = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1])
const scripts = refs.filter((f) => f.endsWith('.js'))
const styles = refs.filter((f) => f.endsWith('.css'))

if (scripts.length > 1) {
  console.error(`检测到 ${scripts.length} 个 JS 分块，无法内联为单文件`)
  process.exit(1)
}

for (const file of styles) {
  const css = readFileSync(join(dist, file), 'utf8')
  html = html.replace(
    new RegExp(`<link[^>]*href="\\./${file}"[^>]*>`),
    `<style>\n${css}\n</style>`
  )
}

// 内联后的 <script> 变成同步脚本，必须挪到 </body> 前，
// 否则在 <head> 里执行时 #app 还没解析，Vue 挂载会失败
for (const file of scripts) {
  const js = readFileSync(join(dist, file), 'utf8')
  const tag = new RegExp(`<script[^>]*src="\\./${file}"[^>]*></script>`)
  html = html.replace(tag, '')
  // 必须用函数形式替换：压缩后的 JS 里含 `$&` / `$'` 等序列，
  // 用字符串替换会被当成 pattern 展开成 `</body>`，直接产生语法错误
  html = html.replace('</body>', () => `  <script>\n${js}\n  </script>\n  </body>`)
}

if (/<script[^>]*type="module"/.test(html) || /<link[^>]*rel="stylesheet"/.test(html)) {
  console.error('仍有未内联的外部资源，请检查构建配置')
  process.exit(1)
}

writeFileSync(htmlPath, html)
rmSync(join(dist, 'assets'), { recursive: true, force: true })

const kb = (statSync(htmlPath).size / 1024).toFixed(1)
const left = existsSync(join(dist, 'assets')) ? readdirSync(join(dist, 'assets')) : []
console.log(`已内联为单文件：dist/index.html（${kb} KB），残留目录：${left.length ? left.join(',') : '无'}`)
