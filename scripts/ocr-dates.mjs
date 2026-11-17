#!/usr/bin/env node
/**
 * 轻量 OCR 预识别：只用 Windows 自带的 Windows.Media.Ocr，不引入任何第三方 OCR 依赖。
 *
 * 流程：
 *   1. 裁出每张图左上角的日期区域（按深色像素自动定位文字块，而不是固定框）
 *   2. 放大 3 倍，生成灰度锐化、二值化两个版本
 *   3. 调用 scripts/ocr-windows.ps1 批量识别
 *   4. 解析多种日期写法，按发布日期就近推断年份，输出最多 3 个候选
 *   5. 写入 data/ocr.json，供 build-index.mjs 预填审核建议
 *
 * 用法：
 *   node scripts/ocr-dates.mjs            # 增量：已有裁剪与结果时复用
 *   node scripts/ocr-dates.mjs --force    # 全部重跑
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'images', 'original')
const CROP_DIR = path.join(ROOT, '.cache', 'ocr-crops')
const RAW_FILE = path.join(ROOT, '.cache', 'ocr-raw.json')
const OUT_FILE = path.join(ROOT, 'data', 'ocr.json')
const PS1 = path.join(__dirname, 'ocr-windows.ps1')

const FORCE = process.argv.includes('--force')
const ONLY = process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1] ?? ''
const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-[A-Za-z0-9_-]{11}(?:-\d+)?\.jpe?g$/i
const log = (...m) => console.log('[ocr]', ...m)

function publishedAtOf(name) {
  const m = NAME_RE.exec(name)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/** 在左上角区域里找深色像素包围盒，返回原始图片坐标 */
async function findTextBlock(file, width, height) {
  const regionW = Math.max(60, Math.round(width * 0.62))
  const regionH = Math.max(50, Math.round(height * 0.28))
  const sampleW = Math.min(420, regionW)
  const { data, info } = await sharp(file)
    .extract({ left: 0, top: 0, width: Math.min(width, regionW), height: Math.min(height, regionH) })
    .resize({ width: sampleW })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  const mean = sum / data.length
  const threshold = Math.max(60, Math.min(190, mean * 0.62))

  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null

  const scaleX = regionW / info.width
  const scaleY = regionH / info.height
  const padX = Math.round(8 * scaleX)
  const padY = Math.round(8 * scaleY)
  let left = Math.max(0, Math.round(minX * scaleX) - padX)
  let top = Math.max(0, Math.round(minY * scaleY) - padY)
  let boxW = Math.min(width - left, Math.round((maxX - minX + 1) * scaleX) + padX * 2)
  let boxH = Math.min(height - top, Math.round((maxY - minY + 1) * scaleY) + padY * 2)

  // 包围盒太碎或几乎占满整块区域时，退回固定比例裁切
  if (boxW < 24 || boxH < 14 || boxW * boxH > regionW * regionH * 0.92) {
    left = 0
    top = 0
    boxW = Math.round(width * 0.5)
    boxH = Math.round(height * 0.22)
  }
  return { left, top, width: boxW, height: boxH }
}

async function prepareCrops(name) {
  const file = path.join(SRC_DIR, name)
  const base = name.replace(/\.jpe?g$/i, '')
  const outA = path.join(CROP_DIR, `${base}__a.png`)
  const outB = path.join(CROP_DIR, `${base}__b.png`)
  if (!FORCE && fs.existsSync(outA) && fs.existsSync(outB)) return [outA, outB]

  const meta = await sharp(file).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (!width || !height) return []

  const box = (await findTextBlock(file, width, height)) ?? {
    left: 0,
    top: 0,
    width: Math.round(width * 0.5),
    height: Math.round(height * 0.22),
  }

  const scale = Math.max(2, Math.min(4, Math.round(360 / Math.max(1, box.width))))
  const size = { width: Math.max(24, Math.round(box.width * scale)) }
  await sharp(file).extract(box).resize(size).greyscale().normalize().sharpen().png().toFile(outA)
  await sharp(file).extract(box).resize(size).greyscale().normalize().threshold(150).png().toFile(outB)
  return [outA, outB]
}

function normalizeText(text) {
  return String(text || '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, '/')
    .replace(/[．]/g, '.')
    .replace(/[－ー—−]/g, '-')
    .replace(/[　]/g, ' ')
    // Windows OCR 常把手写「月」认成这些形近字
    .replace(/[目且巪冃冚冄闫闰]|冂/g, '月')
    // 手写「1」常被认成反斜杠、竖线或字母 l / I；只在该位置像数字时替换
    .replace(/\\/g, ' 1 ')
    .replace(/(?<=\d)\s*[|lI]\s*(?=\d|\s*(?:日|月|$))/g, '1')
    // 行尾的 B / 白 / 曰 多半是「日」
    .replace(/(?<=\d)\s*[B白曰]\s*$/g, ' 日')
    // 手写数字常被拆开：把「2 0 日」「1 0 月」「3 1 日」粘回去
    .replace(/(\d)\s+(\d)(?=\s*月)/g, '$1$2')
    .replace(/(\d)\s+(\d)(?=\s*日)/g, '$1$2')
    // 「5 月 3 1」这类月份后面被拆开的两位日号（没有「日」字结尾）也要粘回去
    .replace(/(月)\s*(\d)\s+(\d)(?!\d)/g, '$1$2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

function validMonthDay(month, day) {
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const max = new Date(2000, month, 0).getDate()
  return day <= max
}

function extractMatches(text) {
  const out = []
  const full = /(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?/g
  let m
  while ((m = full.exec(text))) {
    const month = Number(m[2])
    const day = Number(m[3])
    if (validMonthDay(month, day)) {
      out.push({ raw: m[0].trim(), year: Number(m[1]), month, day, base: 0.8, atStart: m.index === 0 })
    }
  }
  const zh = /(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g
  while ((m = zh.exec(text))) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (validMonthDay(month, day)) {
      out.push({ raw: m[0].trim(), year: 0, month, day, base: 0.7, atStart: m.index === 0 })
    }
  }
  // OCR 把「月」误认成「日」时：5 日 31 日 也要能读成 5/31
  const confused = /(\d{1,2})\s*[月日]\s*(\d{1,2})\s*日/g
  while ((m = confused.exec(text))) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (validMonthDay(month, day)) {
      out.push({ raw: m[0].trim(), year: 0, month, day, base: 0.6, atStart: m.index === 0 })
    }
  }
  // 只剩三位数字 + 日（分隔符完全丢失）：5 31 日 / 531 日
  const compact = /(\d{1,2})(\d{2})\s*日/g
  while ((m = compact.exec(text))) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (validMonthDay(month, day)) {
      out.push({ raw: m[0].trim(), year: 0, month, day, base: 0.45, atStart: m.index === 0 })
    }
  }
  const slash = /(\d{1,2})\s*[/.-]\s*(\d{1,2})(?!\d)/g
  while ((m = slash.exec(text))) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (validMonthDay(month, day)) {
      out.push({ raw: m[0].trim(), year: 0, month, day, base: 0.55, atStart: m.index === 0 })
    }
  }
  return out
}

function inferYear(month, day, publishedAt) {
  if (!publishedAt) return 0
  const [py, pm, pd] = publishedAt.split('-').map(Number)
  const target = Date.UTC(py, pm - 1, pd)
  let best = null
  for (const year of [py - 1, py, py + 1]) {
    const diff = Math.abs(Date.UTC(year, month - 1, day) - target)
    if (!best || diff < best.diff) best = { year, diff }
  }
  return best.year
}

function candidatesOf(texts, publishedAt) {
  const best = new Map()
  for (const text of texts) {
    const matches = extractMatches(text)
    for (const match of matches) {
      const key = `${match.month}-${match.day}`
      let confidence = match.base + (match.atStart ? 0.1 : 0)
      // 两个预处理版本都识别到同一天，提升置信度
      const hits = texts.filter((t) => extractMatches(t).some((x) => x.month === match.month && x.day === match.day)).length
      confidence += Math.max(0, hits - 1) * 0.08
      confidence = Math.min(0.95, Math.round(confidence * 100) / 100)
      const year = match.year || inferYear(match.month, match.day, publishedAt)
      const prev = best.get(key)
      if (!prev || confidence > prev.confidence) {
        best.set(key, {
          dateText: match.raw,
          year,
          month: match.month,
          day: match.day,
          confidence,
          engines: ['windows'],
        })
      }
    }
  }
  return [...best.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}

async function main() {
  const started = Date.now()
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[ocr] 找不到原图目录：${SRC_DIR}`)
    process.exit(1)
  }
  await fsp.mkdir(CROP_DIR, { recursive: true })
  await fsp.mkdir(path.dirname(OUT_FILE), { recursive: true })

  const names = (await fsp.readdir(SRC_DIR))
    .filter((name) => /\.jpe?g$/i.test(name))
    .filter((name) => !ONLY || name.includes(ONLY))
    .sort()
  log(`共 ${names.length} 张图片，准备左上角裁切…`)

  const cropNames = []
  for (let i = 0; i < names.length; i++) {
    const crops = await prepareCrops(names[i])
    for (const crop of crops) cropNames.push(path.basename(crop))
    if ((i + 1) % 50 === 0 || i + 1 === names.length) {
      process.stdout.write(`\r[ocr] 裁切 ${i + 1}/${names.length}`)
    }
  }
  process.stdout.write('\n')

  let raw = {}
  if (!FORCE && fs.existsSync(RAW_FILE)) {
    try {
      raw = JSON.parse(await fsp.readFile(RAW_FILE, 'utf8'))
    } catch {
      raw = {}
    }
  }
  const missing = cropNames.filter((name) => typeof raw[name] !== 'string')
  if (FORCE) {
    for (const name of cropNames) delete raw[name]
    missing.length = 0
    missing.push(...cropNames)
  }
  if (missing.length) {
    log(`调用 Windows OCR 识别 ${cropNames.length} 个裁切（缺失 ${missing.length} 个）…`)
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-CropDir', CROP_DIR, '-OutFile', RAW_FILE],
      { stdio: 'inherit' },
    )
    raw = JSON.parse(await fsp.readFile(RAW_FILE, 'utf8'))
  }

  const files = {}
  let recognized = 0
  let high = 0
  let mid = 0
  let low = 0
  for (const name of names) {
    const base = name.replace(/\.jpe?g$/i, '')
    const texts = [raw[`${base}__a.png`], raw[`${base}__b.png`]]
      .map(normalizeText)
      .filter(Boolean)
    const publishedAt = publishedAtOf(name)
    const candidates = candidatesOf(texts, publishedAt)
    const rawText = texts.join(' / ').slice(0, 300)
    files[name] = { rawText, candidates, best: candidates[0] ?? null }
    if (candidates.length) {
      recognized++
      const confidence = candidates[0].confidence
      if (confidence >= 0.75) high++
      else if (confidence >= 0.5) mid++
      else low++
    }
  }

  const stats = {
    total: names.length,
    recognized,
    noResult: names.length - recognized,
    high,
    mid,
    low,
    rate: names.length ? Math.round((recognized / names.length) * 1000) / 10 : 0,
  }
  const payload = {
    version: 1,
    engine: 'windows-ocr',
    generatedAt: new Date().toISOString(),
    stats,
    files,
  }
  await fsp.writeFile(OUT_FILE, JSON.stringify(payload))
  log(`识别成功 ${recognized}/${names.length}（${stats.rate}%）：高置信 ${high}，中 ${mid}，低 ${low}`)
  log(`结果写入 ${path.relative(ROOT, OUT_FILE)}，用时 ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((err) => {
    console.error('[ocr] 失败：', err)
    process.exit(1)
  })
}

export { normalizeText, extractMatches, candidatesOf }
