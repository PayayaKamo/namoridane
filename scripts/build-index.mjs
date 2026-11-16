#!/usr/bin/env node
/**
 * 生成站点数据：扫描原图目录 -> 输出缩略图 / 大图 / 索引 / 色板 / 种子数据
 *
 * 用法：
 *   node scripts/build-index.mjs            # 增量生成
 *   node scripts/build-index.mjs --force    # 全部重新生成
 *   node scripts/build-index.mjs --src=../namoridane
 *
 * 设计要点：
 * - 原图不进入部署包，只把 WebP 衍生图输出到 public/ 下；
 * - .cache/images.json 记录每个文件的 mtime/size，未变化就跳过，可反复执行；
 * - 文件名约定 YYYY-MM-DD-<11位shortcode>[-序号].jpg，日期为发布时间；
 * - 每张图额外提取 6 色色板，供「相似作品」推荐与配色展示使用。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const srcArg = args.find((a) => a.startsWith('--src='))

/** 仓库内 images/original 优先，其次兼容仓库外的 ../namoridane */
function resolveSourceDir() {
  if (srcArg) return path.resolve(ROOT, srcArg.slice('--src='.length))
  if (process.env.NAMORI_SRC) return path.resolve(ROOT, process.env.NAMORI_SRC)
  const repoDir = path.join(ROOT, 'images', 'original')
  if (fs.existsSync(repoDir)) return repoDir
  return path.resolve(ROOT, '..', 'namoridane')
}
const SRC_DIR = resolveSourceDir()

const OUT_THUMB = path.join(ROOT, 'public', 'images', 'thumb')
const OUT_LARGE = path.join(ROOT, 'public', 'images', 'large')
const OUT_DATA = path.join(ROOT, 'public', 'data')
const CACHE_DIR = path.join(ROOT, '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'images.json')

const THUMB_WIDTH = 480
const LARGE_WIDTH = 1400
const CACHE_VERSION = 3
const CONCURRENCY = 6

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9_-]{11})(?:-(\d+))?\.jpe?g$/i

const log = (...m) => console.log('[data]', ...m)

function parseName(fileName) {
  const m = NAME_RE.exec(fileName)
  if (!m) return null
  const [, y, mo, d, shortcode, idx] = m
  return {
    publishedAt: `${y}-${mo}-${d}`,
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    shortcode,
    postIndex: idx === undefined ? 0 : Number(idx),
  }
}

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function shiftDay({ year, month, day }, delta) {
  const t = new Date(Date.UTC(year, month - 1, day))
  t.setUTCDate(t.getUTCDate() + delta)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
  }
}

/** 白底手绘图的平均亮度，用于骨架屏占位色 */
function toHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** 在 48x48 缩略像素上做轻量 k-means，得到 6 色色板（按占比排序） */
function extractPalette(raw, channels) {
  const pixels = []
  for (let i = 0; i < raw.length; i += channels) {
    const r = raw[i]
    const g = raw[i + 1]
    const b = raw[i + 2]
    // 忽略接近纯白的纸底，色板更接近画面主色
    if (r > 246 && g > 246 && b > 246) continue
    pixels.push([r, g, b])
  }
  const source = pixels.length > 40 ? pixels : (() => {
    const all = []
    for (let i = 0; i < raw.length; i += channels) all.push([raw[i], raw[i + 1], raw[i + 2]])
    return all
  })()
  if (!source.length) return []

  const K = 6
  const step = Math.max(1, Math.floor(source.length / K))
  let centers = []
  for (let i = 0; i < K; i++) {
    centers.push([...source[Math.min(source.length - 1, i * step)]])
  }

  const assign = new Array(source.length).fill(0)
  for (let iter = 0; iter < 10; iter++) {
    const sums = Array.from({ length: K }, () => [0, 0, 0, 0])
    for (let i = 0; i < source.length; i++) {
      const [r, g, b] = source[i]
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < K; c++) {
        const [cr, cg, cb] = centers[c]
        const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if (dist < bestDist) {
          bestDist = dist
          best = c
        }
      }
      assign[i] = best
      const s = sums[best]
      s[0] += r
      s[1] += g
      s[2] += b
      s[3] += 1
    }
    for (let c = 0; c < K; c++) {
      const s = sums[c]
      if (s[3] > 0) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]
    }
  }

  const counts = new Array(K).fill(0)
  assign.forEach((c) => counts[c]++)
  return centers
    .map((c, i) => ({ hex: toHex(...c), n: counts[i] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.hex)
}

async function averageColor(file) {
  const { data, info } = await sharp(file)
    .resize(32, 32, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let r = 0
  let g = 0
  let b = 0
  const n = info.width * info.height
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return toHex(r / n, g / n, b / n)
}

async function paletteOf(file) {
  const { data, info } = await sharp(file)
    .resize(48, 48, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return extractPalette(data, info.channels)
}

async function processOne(file, name, parsed, cached) {
  const outName = `${parsed.shortcode}${parsed.postIndex ? `-${parsed.postIndex}` : ''}`
  const thumbRel = `images/thumb/${outName}.webp`
  const largeRel = `images/large/${outName}.webp`
  const thumbAbs = path.join(ROOT, 'public', thumbRel)
  const largeAbs = path.join(ROOT, 'public', largeRel)

  if (!FORCE && cached && cached.thumb === thumbRel && cached.large === largeRel) {
    const [tOk, lOk] = await Promise.all([
      fsp.access(thumbAbs).then(() => true, () => false),
      fsp.access(largeAbs).then(() => true, () => false),
    ])
    if (tOk && lOk) return cached
  }

  const image = sharp(file, { failOn: 'none' }).rotate()
  const meta = await image.metadata()
  const width = meta.width || 0
  const height = meta.height || 0

  await Promise.all([
    sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(thumbAbs),
    sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(largeAbs),
  ])

  const [palette, color] = await Promise.all([paletteOf(file), averageColor(file)])

  return {
    thumb: thumbRel,
    large: largeRel,
    w: width,
    h: height,
    palette,
    color,
    mtimeMs: 0,
    size: 0,
  }
}

async function pool(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  let done = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        results[i] = await worker(items[i], i)
        done++
        if (done % 25 === 0 || done === items.length) {
          process.stdout.write(`\r[data] 处理中 ${done}/${items.length}`)
        }
      }
    }),
  )
  process.stdout.write('\n')
  return results
}

async function main() {
  const started = Date.now()
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[data] 找不到原图目录：${SRC_DIR}`)
    process.exit(1)
  }
  await Promise.all([
    fsp.mkdir(OUT_THUMB, { recursive: true }),
    fsp.mkdir(OUT_LARGE, { recursive: true }),
    fsp.mkdir(OUT_DATA, { recursive: true }),
    fsp.mkdir(CACHE_DIR, { recursive: true }),
  ])

  let cache = { version: CACHE_VERSION, files: {} }
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const parsed = JSON.parse(await fsp.readFile(CACHE_FILE, 'utf8'))
      if (parsed.version === CACHE_VERSION && parsed.files) cache = parsed
    } catch {
      log('缓存损坏，将全部重建')
    }
  }

  const names = (await fsp.readdir(SRC_DIR, { withFileTypes: true }))
    .filter((d) => d.isFile() && /\.jpe?g$/i.test(d.name))
    .map((d) => d.name)
    .sort()

  const entries = []
  const skippedNames = []
  for (const name of names) {
    const parsed = parseName(name)
    if (!parsed) {
      skippedNames.push(name)
      continue
    }
    const file = path.join(SRC_DIR, name)
    const stat = await fsp.stat(file)
    const cacheKey = `${name}:${stat.size}:${Math.round(stat.mtimeMs)}`
    const cached = cache.files[cacheKey]
    entries.push({ name, file, parsed, cacheKey, cached })
  }

  if (skippedNames.length) {
    log(`跳过 ${skippedNames.length} 个不符合命名规则的文件：`, skippedNames.slice(0, 5))
  }
  log(`扫描到 ${entries.length} 张图片，源目录 ${SRC_DIR}`)

  const nextCache = { version: CACHE_VERSION, files: {} }
  let reused = 0
  let generated = 0

  const processed = await pool(entries, CONCURRENCY, async (entry) => {
    if (entry.cached && !FORCE) reused++
    else generated++
    const result = await processOne(entry.file, entry.name, entry.parsed, entry.cached)
    nextCache.files[entry.cacheKey] = result
    return { ...entry, ...result }
  })

  await fsp.writeFile(CACHE_FILE, JSON.stringify(nextCache))

  // 按 shortcode 分组，得到同一帖子的多图编号
  const posts = new Map()
  for (const e of processed) {
    if (!posts.has(e.parsed.shortcode)) posts.set(e.parsed.shortcode, [])
    posts.get(e.parsed.shortcode).push(e)
  }
  for (const list of posts.values()) list.sort((a, b) => a.parsed.postIndex - b.parsed.postIndex)

  const items = []
  const issues = []
  for (const e of processed) {
    const list = posts.get(e.parsed.shortcode)
    const postIndex = list.findIndex((x) => x.name === e.name)
    const id = list.length > 1 ? `${e.parsed.shortcode}-${postIndex}` : e.parsed.shortcode
    if (list.length > 1 && list.filter((x) => x.parsed.postIndex === e.parsed.postIndex).length > 1) {
      issues.push(`${e.parsed.shortcode} 存在重复序号`)
    }
    const inferred = shiftDay(e.parsed, -1)
    items.push({
      id,
      shortcode: e.parsed.shortcode,
      file: e.name,
      postIndex,
      postCount: list.length,
      publishedAt: e.parsed.publishedAt,
      inferredMonth: inferred.month,
      inferredDay: inferred.day,
      // 年份按发布年份处理，跨年时在界面上可修改
      inferredYear: e.parsed.year,
      rollover: inferred.year !== e.parsed.year ? 'year' : inferred.month !== e.parsed.month ? 'month' : '',
      thumb: e.thumb,
      large: e.large,
      w: e.w,
      h: e.h,
      palette: e.palette,
      color: e.color,
    })
  }

  items.sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? -1 : 1
    return a.postIndex - b.postIndex
  })

  const years = {}
  for (const it of items) {
    const y = it.publishedAt.slice(0, 4)
    years[y] = (years[y] || 0) + 1
  }

  const index = {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    count: items.length,
    years,
    items,
  }
  await fsp.writeFile(path.join(OUT_DATA, 'index.json'), JSON.stringify(index))

  // 种子标注数据：优先 data/userdata.json，其次 data/userdata.example.json
  const seedCandidates = [
    path.join(ROOT, 'data', 'userdata.json'),
    path.join(ROOT, 'data', 'userdata.example.json'),
  ]
  for (const candidate of seedCandidates) {
    if (fs.existsSync(candidate)) {
      await fsp.copyFile(candidate, path.join(OUT_DATA, 'userdata.seed.json'))
      log(`种子标注：${path.relative(ROOT, candidate)}`)
      break
    }
  }

  const thumbCount = (await fsp.readdir(OUT_THUMB)).filter((f) => f.endsWith('.webp')).length
  const largeCount = (await fsp.readdir(OUT_LARGE)).filter((f) => f.endsWith('.webp')).length
  log(`完成：索引 ${items.length} 条，缩略图 ${thumbCount}，大图 ${largeCount}`)
  log(`新生成 ${generated}，复用缓存 ${reused}，用时 ${((Date.now() - started) / 1000).toFixed(1)}s`)
  if (thumbCount < items.length || largeCount < items.length) {
    console.error('[data] 衍生图数量不足，请加上 --force 重跑')
    process.exit(1)
  }
  if (issues.length) log('命名异常：', [...new Set(issues)].slice(0, 10))
}

main().catch((err) => {
  console.error('[data] 生成失败：', err)
  process.exit(1)
})
