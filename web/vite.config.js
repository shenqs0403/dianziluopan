import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 产物说明：
// 1. base: './' 相对路径，Android assets / iOS Bundle / 鸿蒙 rawfile 都能直接加载 index.html
// 2. 打成 IIFE 单文件并把 CSS/JS 内联进 index.html（见 scripts/inline-dist.mjs）——
//    ES module 脚本在 file:// 下会被 CORS 拦截，单文件可避免，四端都只拷一个 html
// 3. target 必须是 chrome51：Android 7（API 24）的系统 WebView 就是 Chromium 51，
//    比它新的语法（async/await、对象展开等）会直接抛 SyntaxError，界面整块白屏。
//    各端 WebView/内核版本只会更旧不会更新，所以这里按最低的 Android 7 对齐。
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'chrome51',
    cssTarget: 'chrome51',
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]'
      }
    }
  },
  server: { host: '0.0.0.0', port: 5173 }
})
