import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { applyReviewExport, sanitizePublicData, validateUserData } from './scripts/lib/public-data.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const MAX_BODY_BYTES = 100 * 1024 * 1024
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { version?: string }

/**
 * 本地管理端专用：把当前浏览器里的数据写回仓库 JSON。
 * 仅在 admin 模式的 dev server 中注册；公开构建与公开 dev 模式都没有该接口。
 */
function adminDataWritePlugin(): Plugin {
  const dataDir = path.join(ROOT, 'data')
  const backupDir = path.join(ROOT, '.cache', 'data-backups')
  const targets = {
    public: { file: path.join(dataDir, 'public.json'), label: 'public' },
    review: { file: path.join(dataDir, 'userdata.json'), label: 'userdata' },
  } as const
  type Target = keyof typeof targets

  const send = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  const readBody = async (req: import('node:http').IncomingMessage) => {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) throw new Error('请求体过大')
      chunks.push(Buffer.from(chunk))
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
  }

  const writeAtomic = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    fs.writeFileSync(temp, text)
    fs.renameSync(temp, file)
  }

  const backup = (file: string, label: string) => {
    if (!fs.existsSync(file)) return null
    fs.mkdirSync(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = path.join(backupDir, `${label}-${stamp}.json`)
    fs.copyFileSync(file, dest)
    return path.relative(ROOT, dest).split(path.sep).join('/')
  }

  return {
    name: 'namori-admin-data-write',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__admin/write-data')) return next()
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: '仅支持 POST' })
        const target = new URL(req.url, 'http://localhost').searchParams.get('target')
        if (target !== 'public' && target !== 'review') {
          return send(res, 400, { ok: false, error: 'target 必须是 public 或 review' })
        }
        const spec = targets[target as Target]
        const relative = path.relative(dataDir, spec.file)
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          return send(res, 400, { ok: false, error: '拒绝写入 data 目录之外的文件' })
        }

        let body: unknown
        try {
          body = await readBody(req)
        } catch (error) {
          return send(res, 400, { ok: false, error: (error as Error).message || '请求体不是合法 JSON' })
        }

        try {
          let payload: unknown
          if (target === 'public') {
            payload = sanitizePublicData(body)
          } else if ((body as { type?: unknown } | null)?.type === 'namori-diary-review') {
            if (!fs.existsSync(spec.file)) {
              throw new Error('尚无 data/userdata.json，请先写入完整审核数据再导入审核导出文件')
            }
            const base = JSON.parse(fs.readFileSync(spec.file, 'utf8'))
            payload = applyReviewExport(base, body).data
          } else {
            payload = validateUserData(body)
          }
          const text = `${JSON.stringify(payload, null, 2)}\n`
          const backupPath = backup(spec.file, spec.label)
          writeAtomic(spec.file, text)
          send(res, 200, {
            ok: true,
            target,
            path: `data/${path.basename(spec.file)}`,
            backup: backupPath,
            writtenAt: new Date().toISOString(),
            bytes: Buffer.byteLength(text),
            items: Object.keys((payload as { items?: Record<string, unknown> }).items ?? {}).length,
          })
        } catch (error) {
          send(res, 400, { ok: false, error: (error as Error).message || '数据校验失败' })
        }
      })
    },
  }
}

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

// 公开构建部署在 GitHub Pages 子路径 /namoridane/，使用绝对 base，
// 保证深链（/item/xxx/）直接打开或刷新时资源仍然从站点根加载。
// 本地管理端与开发服务器仍使用根路径。
export default defineConfig(({ command, mode }) => ({
  base: mode === 'public' ? '/namoridane/' : '/',
  plugins: [
    react(),
    command === 'serve' && mode !== 'public' ? adminDataWritePlugin() : null,
    command === 'serve' && mode !== 'public' ? adminTrashPlugin() : null,
  ].filter(Boolean),
  define: {
    __APP_MODE__: JSON.stringify(mode === 'public' ? 'public' : 'admin'),
    __APP_VERSION__: JSON.stringify(PKG.version ?? '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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
