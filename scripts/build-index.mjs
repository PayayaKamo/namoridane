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
 * - 原始 JPG 同步到 public/images/original/，供站点单张或批量下载；
 * - WebP 衍生图输出到 public/ 下，原图归档目录本身不复制进 dist；
 * - .cache/images.json 记录每个文件的 mtime/size，未变化就跳过，可反复执行；
 * - 文件名约定 YYYY-MM-DD-<11位shortcode>[-序号].jpg，日期为发布时间；
 * - 每张图额外提取 6 色色板，供「相似作品」推荐与配色展示使用。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const srcArg = args.find((a) => a.startsWith('--src='))

/**
 * 原图目录：显式参数 / 环境变量优先，否则固定使用仓库内的 images/original。
 * 不再自动回退到仓库外的旧目录，避免清空后重新吸入旧数据。
 */
function resolveSourceDir() {
  if (srcArg) return path.resolve(ROOT, srcArg.slice('--src='.length))
  if (process.env.NAMORI_SRC) return path.resolve(ROOT, process.env.NAMORI_SRC)
  return path.join(ROOT, 'images', 'original')
}
const SRC_DIR = resolveSourceDir()

const OUT_THUMB = path.join(ROOT, 'public', 'images', 'thumb')
const OUT_LARGE = path.join(ROOT, 'public', 'images', 'large')
const OUT_ORIGINAL = path.join(ROOT, 'public', 'images', 'original')
const OUT_DATA = path.join(ROOT, 'public', 'data')
const CACHE_DIR = path.join(ROOT, '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'images.json')
const OCR_FILE = path.join(ROOT, 'data', 'ocr.json')
const SOURCE_NAMES_FILE = path.join(ROOT, 'data', 'source-names.json')
const POST_META_FILE = path.join(ROOT, 'data', 'post-meta.json')
const PUBLIC_DATA_FILE = path.join(ROOT, 'data', 'public.json')

const MODE =
  (process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] ||
    process.env.APP_MODE ||
    'admin') === 'public'
    ? 'public'
    : 'admin'

const THUMB_WIDTH = 480
const LARGE_WIDTH = 1400
const CACHE_VERSION = 4
const INDEX_VERSION = 8
const CONCURRENCY = 6

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9_-]{11})(?:-(\d+))?\.jpe?g$/i
const UNKNOWN_RE = /^unknown-(.+)\.jpe?g$/i

const log = (...m) => console.log('[data]', ...m)

function parseName(fileName) {
  const m = NAME_RE.exec(fileName)
  if (m) {
    const [, y, mo, d, shortcode, idx] = m
    return {
      publishedAt: `${y}-${mo}-${d}`,
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      shortcode,
      postIndex: idx === undefined ? 0 : Number(idx),
      dateKnown: true,
    }
  }
  // 拿不到发布日期的图片：文件名保留原始来源，日期留待人工审核
  const u = UNKNOWN_RE.exec(fileName)
  if (u) {
    return {
      publishedAt: '',
      year: 0,
      month: 0,
      day: 0,
      shortcode: `unknown-${u[1]}`,
      postIndex: 0,
      dateKnown: false,
    }
  }
  return null
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
  // 原图始终同步；目标已存在且大小一致时跳过复制，保持增量执行
  const originalAbs = path.join(OUT_ORIGINAL, name)
  const [sourceStat, targetStat] = await Promise.all([
    fsp.stat(file),
    fsp.stat(originalAbs).catch(() => null),
  ])
  if (!targetStat || targetStat.size !== sourceStat.size) await fsp.copyFile(file, originalAbs)

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

async function loadOcrResults() {
  try {
    const parsed = JSON.parse(await fsp.readFile(OCR_FILE, 'utf8'))
    log(`OCR 预识别：${parsed?.stats?.recognized ?? 0}/${parsed?.stats?.total ?? 0} 张有候选日期`)
    return parsed?.files ?? {}
  } catch {
    log('未找到 data/ocr.json，审核页将只提供「发布日 - 1 天」推测值')
    return {}
  }
}

/** 导入时保留的原始 CDN 文件名：目标文件名 -> sourceFile */
async function loadSourceNames() {
  try {
    const parsed = JSON.parse(await fsp.readFile(SOURCE_NAMES_FILE, 'utf8'))
    log(`原始文件名映射：${Object.keys(parsed).length} 条`)
    return parsed
  } catch {
    log('未找到 data/source-names.json，索引不含 sourceFile')
    return {}
  }
}

/** 导入时保留的帖子元数据：目标文件名 -> { shortcode, caption, permalink } */
async function loadPostMeta() {
  try {
    const parsed = JSON.parse(await fsp.readFile(POST_META_FILE, 'utf8'))
    const files = parsed?.files ?? {}
    log(`帖子文案：${Object.values(files).filter((m) => m?.caption).length} 条`)
    return files
  } catch {
    log('未找到 data/post-meta.json，索引不含原文案')
    return {}
  }
}

/** 公开站种子：去掉非绘日记、私密备注、未确认推测日期与草稿故事线 */
function prunePublicData(data) {
  const items = {}
  for (const [id, ann] of Object.entries(data.items ?? {})) {
    if (!ann || ann.excluded || ann.deleted) continue
    const next = {
      tags: Array.isArray(ann.tags) ? ann.tags : [],
      favorite: false,
      reviewed: Boolean(ann.reviewed),
      excluded: false,
      note: '',
      updatedAt: ann.updatedAt || new Date().toISOString(),
    }
    if (ann.date?.confirmed) next.date = ann.date
    if (ann.translation) {
      next.translation = {
        source: ann.translation.source ?? '',
        slots: (ann.translation.slots ?? []).map((slot) => ({
          lang: slot.lang,
          label: slot.label,
          text: slot.text,
        })),
        updatedAt: ann.translation.updatedAt || new Date().toISOString(),
      }
    }
    items[id] = next
  }
  return {
    version: data.version ?? 1,
    updatedAt: data.updatedAt || new Date().toISOString(),
    dimensions: data.dimensions ?? [],
    tags: data.tags ?? [],
    characters: data.characters ?? [],
    collections: [],
    storylines: (data.storylines ?? []).filter((story) => story.published),
    items,
  }
}

async function main() {
  const started = Date.now()
  await fsp.mkdir(SRC_DIR, { recursive: true })
  const ocrFiles = await loadOcrResults()
  const sourceNames = await loadSourceNames()
  const postMeta = await loadPostMeta()
  await Promise.all([
    fsp.mkdir(OUT_THUMB, { recursive: true }),
    fsp.mkdir(OUT_LARGE, { recursive: true }),
    fsp.mkdir(OUT_ORIGINAL, { recursive: true }),
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

  let entries = []
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
    entries.push({ name, file, parsed, cacheKey, cached, bytes: stat.size })
  }

  // 稳定 id：同一帖子多图用 shortcode-N；两种构建模式保持一致
  const idByFile = new Map()
  {
    const groups = new Map()
    for (const entry of entries) {
      const key = entry.parsed.shortcode
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(entry)
    }
    for (const [shortcode, list] of groups) {
      list.sort((a, b) => a.parsed.postIndex - b.parsed.postIndex || a.name.localeCompare(b.name))
      list.forEach((entry, index) => {
        idByFile.set(entry.name, list.length > 1 ? `${shortcode}-${index}` : shortcode)
      })
    }
  }

  let publicData = null
  let excludedIds = new Set()
  if (MODE === 'public') {
    if (!fs.existsSync(PUBLIC_DATA_FILE)) {
      console.error('[data] 公开构建需要 data/public.json，请先在管理端「数据与设置」导出发布数据')
      process.exit(1)
    }
    publicData = JSON.parse(await fsp.readFile(PUBLIC_DATA_FILE, 'utf8'))
    excludedIds = new Set(
      Object.entries(publicData.items ?? {})
        .filter(([, ann]) => ann?.excluded || ann?.deleted)
        .map(([id]) => id),
    )
    const before = entries.length
    entries = entries.filter((entry) => !excludedIds.has(idByFile.get(entry.name)))
    log(`公开模式：排除 ${before - entries.length} 张非绘日记`)
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
    const id = idByFile.get(e.name)
    if (list.length > 1 && list.filter((x) => x.parsed.postIndex === e.parsed.postIndex).length > 1) {
      issues.push(`${e.parsed.shortcode} 存在重复序号`)
    }
    // 日记日期的默认值：OCR 候选优先，没有 OCR 时用发布日期前一天（明确标注为推测）
    const ocrEntry = ocrFiles[e.name]
    const ocrBest = ocrEntry?.best ?? null
    const inferred = ocrBest
      ? { year: ocrBest.year, month: ocrBest.month, day: ocrBest.day }
      : e.parsed.dateKnown
        ? shiftDay(e.parsed, -1)
        : { year: 0, month: 0, day: 0 }
    const isPublic = MODE === 'public'
    const meta = postMeta[e.name] ?? null
    // 文案与永久链接只来自公开的帖子元数据；缺失时降级为空，不影响索引生成
    const permalink =
      meta?.permalink ??
      (/^[A-Za-z0-9_-]{11}$/.test(e.parsed.shortcode)
        ? `https://www.instagram.com/p/${e.parsed.shortcode}/`
        : null)
    items.push({
      id,
      shortcode: e.parsed.shortcode,
      file: e.name,
      sourceFile: sourceNames[e.name] ?? null,
      caption: meta?.caption ?? null,
      permalink,
      postIndex,
      postCount: list.length,
      publishedAt: e.parsed.publishedAt,
      dateKnown: e.parsed.dateKnown,
      // 日记日期的初始建议：OCR 图内日期 > 发布日期前一天；没有发布日期时为 0，等待人工确认
      inferredMonth: isPublic ? 0 : inferred.month,
      inferredDay: isPublic ? 0 : inferred.day,
      inferredYear: isPublic ? 0 : inferred.year,
      rollover: e.parsed.dateKnown
        ? inferred.year !== e.parsed.year
          ? 'year'
          : inferred.month !== e.parsed.month
            ? 'month'
            : ''
        : '',
      ocr: isPublic
        ? null
        : ocrEntry
          ? {
              rawText: ocrEntry.rawText ?? '',
              candidates: ocrEntry.candidates ?? [],
            }
          : null,
      suggestedDiaryDate: isPublic || !ocrBest
        ? null
        : { year: ocrBest.year, month: ocrBest.month, day: ocrBest.day },
      thumb: e.thumb,
      large: e.large,
      original: `images/original/${e.name}`,
      bytes: e.bytes,
      w: e.w,
      h: e.h,
      palette: e.palette,
      color: e.color,
    })
  }

  items.sort((a, b) => {
    const ak = a.publishedAt || '9999-99-99'
    const bk = b.publishedAt || '9999-99-99'
    if (ak !== bk) return ak < bk ? -1 : 1
    return a.postIndex - b.postIndex
  })

  const years = {}
  let undated = 0
  for (const it of items) {
    const y = it.publishedAt.slice(0, 4)
    if (!y) {
      undated++
      continue
    }
    years[y] = (years[y] || 0) + 1
  }

  const datasetId = crypto
    .createHash('sha1')
    .update(items.map((item) => `${item.file}:${item.bytes}`).join('|'))
    .digest('hex')
    .slice(0, 12)

  const index = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    datasetId,
    count: items.length,
    undated,
    years,
    items,
  }
  await fsp.writeFile(path.join(OUT_DATA, 'index.json'), JSON.stringify(index))

  // 清理已从归档目录移除的图片，避免旧文件继续进入部署包
  const expectedByDir = [
    [OUT_THUMB, new Set(items.map((item) => path.basename(item.thumb)))],
    [OUT_LARGE, new Set(items.map((item) => path.basename(item.large)))],
    [OUT_ORIGINAL, new Set(items.map((item) => item.file))],
  ]
  for (const [dir, expected] of expectedByDir) {
    for (const name of await fsp.readdir(dir)) {
      if (!expected.has(name)) await fsp.unlink(path.join(dir, name))
    }
  }

  // 种子标注数据：公开模式用 data/public.json 的裁剪版；管理端优先 data/userdata.json
  if (MODE === 'public') {
    await fsp.writeFile(path.join(OUT_DATA, 'userdata.seed.json'), JSON.stringify(prunePublicData(publicData)))
    log('种子标注：data/public.json（已裁剪公开内容）')
  } else {
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
  }

  const thumbCount = (await fsp.readdir(OUT_THUMB)).filter((f) => f.endsWith('.webp')).length
  const largeCount = (await fsp.readdir(OUT_LARGE)).filter((f) => f.endsWith('.webp')).length
  const originalCount = (await fsp.readdir(OUT_ORIGINAL)).filter((f) => /\.jpe?g$/i.test(f)).length
  log(`完成：索引 ${items.length} 条，缩略图 ${thumbCount}，大图 ${largeCount}，原图 ${originalCount}`)
  log(`新生成 ${generated}，复用缓存 ${reused}，用时 ${((Date.now() - started) / 1000).toFixed(1)}s`)
  if (thumbCount < items.length || largeCount < items.length || originalCount !== items.length) {
    console.error('[data] 衍生图数量不足，请加上 --force 重跑')
    process.exit(1)
  }
  if (issues.length) log('命名异常：', [...new Set(issues)].slice(0, 10))
}

main().catch((err) => {
  console.error('[data] 生成失败：', err)
  process.exit(1)
})
