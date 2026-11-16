import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 使用相对路径，产物可直接放到 GitHub Pages 的任意子路径下。
// 站点内部跳转全部走 hash 路由，不依赖服务器 rewrite。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    open: false,
  },
})
