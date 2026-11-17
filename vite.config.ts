import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/**
 * 本地管理端专用的原图回收站接口。
 * 仅在 admin 模式的 dev server 中注册；公开构建不会包含任何删除路径。
 */
function adminTrashPlugin(): Plugin {
  const originalDir = path.join(ROOT, 'images', 'original')
  const trashDir = path.join(ROOT, 'images', '_trash')
  const safeName = (file: string) => path.basename(file)
  const derivative = (file: string) => {
    const base = file.replace(/\.jpe?g$/i, '')
    return [
      path.join(ROOT, 'public', 'images', 'thumb', `${base}.webp`),
      path.join(ROOT, 'public', 'images', 'large', `${base}.webp`),
    ]
  }
  const readBody = async (req: import('node:http').IncomingMessage) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      return {}
    }
  }
  const send = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  return {
    name: 'namori-admin-trash',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__admin/')) return next()
        const url = req.url.split('?')[0]

        if (url === '/__admin/trash' && req.method === 'POST') {
          const body = await readBody(req)
          const files: string[] = Array.isArray(body.files) ? body.files.map(safeName) : []
          fs.mkdirSync(trashDir, { recursive: true })
          const moved: string[] = []
          const missing: string[] = []
          for (const file of files) {
            const from = path.join(originalDir, file)
            const to = path.join(trashDir, file)
            if (!fs.existsSync(from)) {
              missing.push(file)
              continue
            }
            fs.renameSync(from, to)
            for (const target of derivative(file)) {
              if (fs.existsSync(target)) fs.unlinkSync(target)
            }
            moved.push(file)
          }
          send(res, 200, { ok: true, moved, missing })
          return
        }

        if (url === '/__admin/restore' && req.method === 'POST') {
          const body = await readBody(req)
          const files: string[] = Array.isArray(body.files) ? body.files.map(safeName) : []
          fs.mkdirSync(originalDir, { recursive: true })
          const restored: string[] = []
          for (const file of files) {
            const from = path.join(trashDir, file)
            if (!fs.existsSync(from)) continue
            fs.renameSync(from, path.join(originalDir, file))
            restored.push(file)
          }
          send(res, 200, { ok: true, restored })
          return
        }

        if (url === '/__admin/purge' && req.method === 'POST') {
          if (!fs.existsSync(trashDir)) return send(res, 200, { ok: true, removed: 0 })
          const files = fs.readdirSync(trashDir)
          for (const file of files) {
            const target = path.join(trashDir, file)
            if (fs.statSync(target).isFile()) fs.unlinkSync(target)
          }
          send(res, 200, { ok: true, removed: files.length })
          return
        }

        send(res, 404, { ok: false })
      })
    },
  }
}

// base 使用相对路径，产物可直接放到 GitHub Pages 的任意子路径下。
// 站点内部跳转全部走 hash 路由，不依赖服务器 rewrite。
// 构建模式：--mode public 生成粉丝只读站；默认 admin 生成本地管理站。
export default defineConfig(({ command, mode }) => ({
  base: './',
  plugins: [react(), command === 'serve' && mode !== 'public' ? adminTrashPlugin() : null].filter(Boolean),
  define: {
    __APP_MODE__: JSON.stringify(mode === 'public' ? 'public' : 'admin'),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    open: false,
  },
}))
