import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 产物说明：
// 1. base: './' 相对路径，Android assets / iOS Bundle / 鸿蒙 rawfile 都能直接加载 index.html
// 2. 打成 IIFE 单文件并把 CSS/JS 内联进 index.html（见 scripts/inline-dist.mjs）——
//    ES module 脚本在 file:// 下会被 CORS 拦截，单文件可避免，四端都只拷一个 html
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2017',
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
