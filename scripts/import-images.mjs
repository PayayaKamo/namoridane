#!/usr/bin/env node
/**
 * 把一批新下载的图片并入 images/original。
 *
 * 用法：
 *   npm run import -- "<目录>"
 *   npm run import -- "<目录>" --name-map=.cache/old-hash-map.json
 *   npm run import -- "<目录>" --dry-run
 *
 * 支持的目录：
 * - 普通图片目录（递归查找 .jpg/.jpeg）
 * - Instagram 保存页目录（scontent-*.cdninstagram.com 下的 jpg + _DataURI/*.txt +
 *   www.instagram.com 下的 html/json）。脚本会尽量从页面 JSON / DataURI 中解析
 *   shortcode、taken_at 与图片 URL，用发布时间命名；解析不到的文件保持 unknown-*。
 * - instaloader 下载目录（YYYY-MM-DD_HH-MM-SS_<shortcode>.jpg + 同名 .json/.txt）。
 *   json 里的 caption / date / shortcode 会用于命名，并把原文案与 Instagram 永久链接
 *   写入 data/post-meta.json，供站点详情页展示与跳回原帖。
 *
 * 规则：
 * - 以文件内容 SHA-256 去重：已入库或同批重复的图片只保留一份；
 * - 命名优先 --name-map 的 hash -> 文件名 映射；其次 YYYY-MM-DD-<shortcode>[-n].jpg；
 *   否则 unknown-<shortcode>.jpg / unknown-<原文件名>.jpg，等待人工确认；
 * - 已入库清单记录在 .cache/import-manifest.json，重复执行同一批不会产生新条目；
 * - 只复制文件，不改动源目录。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEST_DIR = path.join(ROOT, 'images', 'original')
const CACHE_DIR = path.join(ROOT, '.cache')
const MANIFEST_FILE = path.join(CACHE_DIR, 'import-manifest.json')
const REPORT_FILE = path.join(CACHE_DIR, 'import-report.json')
/** 提交到仓库的映射：目标文件名 -> 导入时的原始文件名（Instagram CDN 名） */
const SOURCE_NAMES_FILE = path.join(ROOT, 'data', 'source-names.json')
/** 提交到仓库的帖子元数据：目标文件名 -> 原文案与 Instagram 永久链接 */
const POST_META_FILE = path.join(ROOT, 'data', 'post-meta.json')
const POST_META_VERSION = 1
const MANIFEST_VERSION = 1
const SHORTCODE_RE = /^[A-Za-z0-9_-]{11}$/

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return undefined
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true
}
const SRC_DIR = positional[0] ? path.resolve(process.cwd(), positional[0]) : ''
const NAME_MAP_FILE = flag('name-map')
const DRY_RUN = Boolean(flag('dry-run'))

const log = (...m) => console.log('[import]', ...m)

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function walk(dir, match) {
  const out = []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full, match)))
    else if (entry.isFile() && match(entry.name)) out.push(full)
  }
  return out
}

async function loadManifest() {
  try {
    const parsed = JSON.parse(await fsp.readFile(MANIFEST_FILE, 'utf8'))
    if (parsed && parsed.version === MANIFEST_VERSION && parsed.files) {
      // 旧清单没有 sourceName：用 source 的 basename 补齐，保证历史数据也能追溯
      for (const entry of Object.values(parsed.files)) {
        if (!entry.sourceName && entry.source) entry.sourceName = path.basename(entry.source)
      }
      return parsed
    }
  } catch {
    // 不存在或损坏时重建
  }
  const manifest = { version: MANIFEST_VERSION, files: {} }
  if (!fs.existsSync(DEST_DIR)) return manifest
  const names = (await fsp.readdir(DEST_DIR)).filter((n) => /\.jpe?g$/i.test(n))
  log(`首次运行，正在为已入库的 ${names.length} 张图片建立去重清单…`)
  for (const name of names) {
    const stat = await fsp.stat(path.join(DEST_DIR, name))
    manifest.files[await sha256File(path.join(DEST_DIR, name))] = {
      file: name,
      bytes: stat.size,
      source: 'existing',
      importedAt: new Date(stat.mtimeMs).toISOString(),
    }
  }
  return manifest
}

async function loadNameMap() {
  if (!NAME_MAP_FILE || NAME_MAP_FILE === true) return {}
  const file = path.resolve(ROOT, String(NAME_MAP_FILE))
  const parsed = JSON.parse(await fsp.readFile(file, 'utf8'))
  if (Array.isArray(parsed)) {
    return Object.fromEntries(parsed.filter((r) => r && r.hash && r.file).map((r) => [r.hash, r.file]))
  }
  return parsed ?? {}
}

/** 读取已提交的帖子元数据，用于增量导入时保留旧文案 */
async function loadPostMeta() {
  try {
    const parsed = JSON.parse(await fsp.readFile(POST_META_FILE, 'utf8'))
    return parsed?.files ?? {}
  } catch {
    return {}
  }
}

function uniqueName(base, used) {
  if (!used.has(base)) return base
  const ext = path.extname(base)
  const stem = base.slice(0, -ext.length)
  let n = 1
  while (used.has(`${stem}-${n}${ext}`)) n++
  return `${stem}-${n}${ext}`
}

function instagramPermalink(shortcode) {
  return SHORTCODE_RE.test(shortcode) ? `https://www.instagram.com/p/${shortcode}/` : null
}

function normalizeCaption(text) {
  return text.replace(/\r\n?/g, '\n').trim()
}

/** instaloader 从文件名解析 shortcode：YYYY-MM-DD_HH-MM-SS_<code>[_n].jpg */
function shortcodeFromFileName(name) {
  const m = /_([A-Za-z0-9_-]{11})(?:_(\d+))?\.jpe?g$/i.exec(name)
  if (!m) return null
  return { code: m[1], index: m[2] ? Number(m[2]) - 1 : -1 }
}

/** 从入库文件名解析 shortcode：YYYY-MM-DD-<code>[-n].jpg（与 build-index 的命名规则一致） */
function shortcodeFromTargetFile(name) {
  const m = /^\d{4}-\d{2}-\d{2}-([A-Za-z0-9_-]{11})(?:-\d+)?\.jpe?g$/i.exec(name)
  return m ? m[1] : null
}

/** instaloader JSON 的文案可能在 node.caption 或 node.iphone_struct.caption.text */
function nodeCaption(node) {
  if (typeof node?.caption === 'string') return node.caption
  if (typeof node?.caption?.text === 'string') return node.caption.text
  if (typeof node?.iphone_struct?.caption?.text === 'string') return node.iphone_struct.caption.text
  return null
}

/** 解析 instaloader 的单帖 JSON；不是该格式时返回 null */
function parseInstaloaderJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const node = parsed?.node
  if (!node?.shortcode) return null
  const date = Number(node.date ?? node.taken_at_timestamp)
  const urls = []
  if (typeof node.display_url === 'string') urls.push(node.display_url)
  for (const edge of node.edge_sidecar_to_children?.edges ?? []) {
    if (typeof edge?.node?.display_url === 'string') urls.push(edge.node.display_url)
  }
  return {
    code: String(node.shortcode),
    takenAt: Number.isFinite(date) && date > 0 ? date : undefined,
    caption: nodeCaption(node),
    urls,
  }
}

/**
 * 从 Instagram 保存页文件里提取 shortcode、发布时间与图片 URL 的对应关系。
 * 返回 { codeTimes, codeImages, codeCaptions, basenameToCode }。
 */
async function scanInstagramMetadata(dir) {
  const codeTimes = new Map()
  const codeImages = new Map()
  const codeCaptions = new Map()
  const basenameToCode = new Map()
  const metaFiles = await walk(dir, (name) => /\.(html?|json|txt|js)$/i.test(name))
  let scanned = 0

  for (const file of metaFiles) {
    let text
    try {
      const stat = await fsp.stat(file)
      if (stat.size > 30 * 1024 * 1024) continue
      text = await fsp.readFile(file, 'utf8')
    } catch {
      continue
    }
    if (/\.txt$/i.test(file) && /^\s*data:[^,]+,/.test(text)) {
      const comma = text.indexOf(',')
      const header = text.slice(0, comma)
      if (/;base64/i.test(header)) {
        try {
          text = Buffer.from(text.slice(comma + 1), 'base64').toString('utf8')
        } catch {
          continue
        }
      }
    }

    // instaloader 的单帖 JSON：文案、时间、图片顺序都在 node 里
    if (/\.json$/i.test(file)) {
      const post = parseInstaloaderJson(text)
      if (post) {
        scanned += 1
        if (post.takenAt) codeTimes.set(post.code, post.takenAt)
        if (typeof post.caption === 'string') codeCaptions.set(post.code, normalizeCaption(post.caption))
        if (!codeImages.has(post.code)) codeImages.set(post.code, [])
        const list = codeImages.get(post.code)
        for (const url of post.urls) {
          const basename = path.basename(url.split('?')[0]).toLowerCase()
          if (!basename || list.includes(basename)) continue
          list.push(basename)
          if (!basenameToCode.has(basename)) basenameToCode.set(basename, post.code)
        }
        continue
      }
    }

    // 同名 .txt 兜底：文件名里带 shortcode，正文通常就是文案
    const txtName = path.basename(file)
    if (/\.txt$/i.test(file) && !text.trimStart().startsWith('<')) {
      const code = shortcodeFromFileName(txtName)?.code
      if (code) {
        const caption = normalizeCaption(text)
        if (caption && !codeCaptions.has(code)) codeCaptions.set(code, caption)
        const parts = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_/.exec(txtName)
        if (parts && !codeTimes.has(code)) {
          const ms = Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6])
          codeTimes.set(code, Math.floor(ms / 1000))
        }
        continue
      }
    }

    if (!text.includes('shortcode') && !text.includes('"code"') && !text.includes('display_url')) continue
    scanned += 1

    const codeRe = /"(?:code|shortcode)"\s*:\s*"([A-Za-z0-9_-]{5,20})"/g
    const matches = [...text.matchAll(codeRe)]
    for (let i = 0; i < matches.length; i += 1) {
      const code = matches[i][1]
      const start = Math.max(0, matches[i].index - 4000)
      const end = Math.min(text.length, (matches[i + 1]?.index ?? matches[i].index + 8000) + 600)
      const windowText = text.slice(start, end)

      const timeMatch = windowText.match(/"taken_at(?:_timestamp)?"\s*:\s*(\d{9,11})/)
      if (timeMatch) codeTimes.set(code, Number(timeMatch[1]))

      const urls = [
        ...windowText.matchAll(/(?:https?:\\?\/\\?\/[^"'\s]*?\/)([A-Za-z0-9_.-]+\.jpe?g)/gi),
        ...windowText.matchAll(/(?:^|[\\/"])([A-Za-z0-9_-]+\.jpe?g)(?=["\\?]|$)/gi),
      ]
      if (!codeImages.has(code)) codeImages.set(code, [])
      const list = codeImages.get(code)
      for (const hit of urls) {
        const basename = path.basename(hit[1]).toLowerCase()
        if (!basename || list.includes(basename)) continue
        list.push(basename)
        if (!basenameToCode.has(basename)) basenameToCode.set(basename, code)
      }
    }
  }

  if (scanned) log(`已解析 ${scanned} 个页面 / JSON 文件，得到 ${codeTimes.size} 个带日期的 shortcode`)
  return { codeTimes, codeImages, codeCaptions, basenameToCode }
}

function dateFromTimestamp(seconds) {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

async function main() {
  if (!SRC_DIR) {
    console.error('用法：npm run import -- "<目录>" [--name-map=<json>] [--dry-run]')
    process.exit(1)
  }
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[import] 找不到目录：${SRC_DIR}`)
    process.exit(1)
  }
  await fsp.mkdir(DEST_DIR, { recursive: true })
  await fsp.mkdir(CACHE_DIR, { recursive: true })

  const manifest = await loadManifest()
  const nameMap = await loadNameMap()
  const knownHashes = new Set(Object.keys(manifest.files))
  const usedNames = new Set(Object.values(manifest.files).map((f) => f.file))

  const files = (await walk(SRC_DIR, (name) => /\.jpe?g$/i.test(name))).sort()
  log(`扫描到 ${files.length} 个 JPG，目标目录 ${path.relative(ROOT, DEST_DIR)}`)

  const { codeTimes, codeImages, codeCaptions, basenameToCode } = await scanInstagramMetadata(SRC_DIR)

  const report = {
    scannedAt: new Date().toISOString(),
    source: SRC_DIR,
    scanned: files.length,
    dated: 0,
    withCaption: 0,
    added: [],
    duplicates: [],
    batchDuplicates: [],
    unknownDate: [],
    skipped: [],
    dryRun: DRY_RUN,
  }

  const records = []
  for (const file of files) {
    const basename = path.basename(file)
    const hash = await sha256File(file)
    if (knownHashes.has(hash)) {
      report.duplicates.push({ file: basename, existing: manifest.files[hash].file })
      continue
    }
    if (records.some((r) => r.hash === hash)) {
      report.batchDuplicates.push({ file: basename })
      continue
    }
    const nameHit = shortcodeFromFileName(basename)
    const code = basenameToCode.get(basename.toLowerCase()) ?? nameHit?.code
    const takenAt = code ? codeTimes.get(code) : undefined
    const mappedPosition = code && codeImages.get(code) ? codeImages.get(code).indexOf(basename.toLowerCase()) : -1
    const position = mappedPosition >= 0 ? mappedPosition : (nameHit?.index ?? -1)
    const caption = code && codeCaptions.has(code) ? codeCaptions.get(code) : null
    records.push({ file, basename, hash, code, takenAt, position, caption })
  }

  // 按发布时间排序，日期未知的排在最后
  records.sort((a, b) => {
    const ta = a.takenAt ?? Number.MAX_SAFE_INTEGER
    const tb = b.takenAt ?? Number.MAX_SAFE_INTEGER
    return ta - tb || (a.code ?? '').localeCompare(b.code ?? '') || (a.position - b.position) || a.basename.localeCompare(b.basename)
  })

  // 同一 shortcode 的多图需要 -n 后缀
  const codeTotals = new Map()
  for (const record of records) {
    if (record.code) codeTotals.set(record.code, (codeTotals.get(record.code) ?? 0) + 1)
  }

  for (const record of records) {
    const { file, basename, hash, code, takenAt, position, caption } = record
    const mapped = nameMap[hash]
    const date = dateFromTimestamp(takenAt)
    const multi = code ? (codeTotals.get(code) ?? 0) > 1 : false
    const suffix = multi && position >= 0 ? `-${position}` : ''
    let preferred
    if (mapped) {
      preferred = mapped
    } else if (date && code) {
      preferred = `${date}-${code}${suffix}.jpg`
    } else if (/^\d{4}-\d{2}-\d{2}-[A-Za-z0-9_-]+(?:-\d+)?\.jpe?g$/i.test(basename)) {
      // 普通目录里已经按规范命名的文件，保留原名
      preferred = basename
    } else if (code) {
      preferred = `unknown-${code}${suffix}.jpg`
    } else {
      preferred = `unknown-${basename}`
    }
    const name = uniqueName(preferred, usedNames)
    const hasDate = /^\d{4}-\d{2}-\d{2}-/.test(name)

    if (DRY_RUN) {
      report.added.push({
        file: basename,
        as: name,
        mapped: Boolean(mapped),
        code: code ?? null,
        takenAt: date,
        caption: caption !== null,
      })
      usedNames.add(name)
      knownHashes.add(hash)
      if (hasDate) report.dated += 1
      else report.unknownDate.push(name)
      if (caption !== null) report.withCaption += 1
      continue
    }

    try {
      await fsp.copyFile(file, path.join(DEST_DIR, name))
    } catch (err) {
      report.skipped.push({ file: basename, reason: err.message })
      continue
    }
    const stat = await fsp.stat(path.join(DEST_DIR, name))
    manifest.files[hash] = {
      file: name,
      bytes: stat.size,
      source: file,
      sourceName: basename,
      shortcode: code ?? null,
      importedAt: new Date().toISOString(),
    }
    usedNames.add(name)
    knownHashes.add(hash)
    report.added.push({
      file: basename,
      as: name,
      mapped: Boolean(mapped),
      code: code ?? null,
      takenAt: date,
      caption: caption !== null,
    })
    if (hasDate) report.dated += 1
    else report.unknownDate.push(name)
    if (caption !== null) report.withCaption += 1
  }

  if (!DRY_RUN) {
    await fsp.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2))
    const sourceNames = {}
    for (const entry of Object.values(manifest.files)) {
      if (entry.file && entry.sourceName) sourceNames[entry.file] = entry.sourceName
    }
    const sorted = Object.fromEntries(Object.entries(sourceNames).sort(([a], [b]) => a.localeCompare(b)))
    await fsp.writeFile(SOURCE_NAMES_FILE, JSON.stringify(sorted, null, 2) + '\n')
    log(`原始文件名映射：${Object.keys(sorted).length} 条 -> ${path.relative(ROOT, SOURCE_NAMES_FILE)}`)

    // 帖子文案与永久链接：按目标文件名归档，已导入文件可复用旧文案
    const previousMeta = await loadPostMeta()
    const metaFiles = {}
    for (const entry of Object.values(manifest.files)) {
      const fileCode = shortcodeFromTargetFile(entry.file) ?? shortcodeFromFileName(entry.file)?.code
      const code = fileCode ?? (SHORTCODE_RE.test(entry.shortcode ?? '') ? entry.shortcode : null)
      const previous = previousMeta[entry.file]
      let fileCaption = code && codeCaptions.has(code) ? codeCaptions.get(code) : undefined
      if (fileCaption === undefined) fileCaption = previous?.caption
      const permalink = code ? instagramPermalink(code) : previous?.permalink ?? null
      if (fileCaption === undefined && !permalink) continue
      metaFiles[entry.file] = {
        shortcode: code,
        caption: fileCaption ?? '',
        permalink: permalink ?? null,
      }
    }
    const sortedMeta = Object.fromEntries(Object.entries(metaFiles).sort(([a], [b]) => a.localeCompare(b)))
    const postMeta = {
      version: POST_META_VERSION,
      updatedAt: new Date().toISOString(),
      files: sortedMeta,
    }
    await fsp.writeFile(POST_META_FILE, JSON.stringify(postMeta, null, 2) + '\n')
    log(`帖子文案：${Object.values(sortedMeta).filter((m) => m.caption).length} 条 -> ${path.relative(ROOT, POST_META_FILE)}`)
  }
  await fsp.writeFile(REPORT_FILE, JSON.stringify(report, null, 2))

  log(`新增 ${report.added.length}（按发布时间命名 ${report.dated}，日期待定 ${report.unknownDate.length}，含文案 ${report.withCaption}）`)
  log(`跳过：已入库 ${report.duplicates.length}，同批重复 ${report.batchDuplicates.length}，失败 ${report.skipped.length}`)
  if (report.unknownDate.length) {
    log('日期待定的文件（可在审核页确认）：', report.unknownDate.slice(0, 5))
    if (report.unknownDate.length > 5) log(`……其余 ${report.unknownDate.length - 5} 个见报告`)
  }
  log(`报告：${path.relative(ROOT, REPORT_FILE)}`)
  if (DRY_RUN) log('dry-run：未写入任何文件')
  log('下一步：运行 npm run data（或 npm run dev）生成衍生图与索引')
}

main().catch((err) => {
  console.error('[import] 失败：', err)
  process.exit(1)
})
