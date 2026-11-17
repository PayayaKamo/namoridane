#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyReviewExport,
  sanitizePublicData,
  validateReviewExport,
  validateUserData,
} from './lib/public-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backupDir = path.join(ROOT, '.cache', 'data-backups')
const targets = {
  public: { file: path.join(ROOT, 'data', 'public.json'), label: 'public' },
  review: { file: path.join(ROOT, 'data', 'userdata.json'), label: 'userdata' },
}

function fail(message) {
  console.error(`[import:data] ${message}`)
  console.error('用法：npm run import:data -- <导出文件.json> --target=public|review')
  process.exit(1)
}

function parseArgs(argv) {
  let file = ''
  let target = ''
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log('用法：npm run import:data -- <导出文件.json> --target=public|review')
      console.log('  public  只保留公开字段，写入 data/public.json')
      console.log('  review  写入 data/userdata.json（完整审核数据或 namori-diary-review 导出）')
      process.exit(0)
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length)
    } else if (arg === '--target') {
      target = argv[++i] ?? ''
    } else if (arg.startsWith('-')) {
      fail(`未知参数 ${arg}`)
    } else if (!file) {
      file = arg
    } else {
      fail(`多余的文件参数 ${arg}`)
    }
  }
  if (!file) fail('缺少导出文件路径')
  if (target !== 'public' && target !== 'review') fail('--target 必须是 public 或 review')
  return { file, target }
}

function backupExisting(file, label) {
  if (!fs.existsSync(file)) return null
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(backupDir, `${label}-${stamp}.json`)
  fs.copyFileSync(file, dest)
  return path.relative(ROOT, dest).split(path.sep).join('/')
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(temp, text)
  fs.renameSync(temp, file)
}

const { file, target } = parseArgs(process.argv.slice(2))
const source = path.resolve(process.cwd(), file)
if (!fs.existsSync(source)) fail(`文件不存在：${source}`)

let raw
try {
  raw = JSON.parse(fs.readFileSync(source, 'utf8').replace(/^\uFEFF/, ''))
} catch (error) {
  fail(`不是合法 JSON：${error.message}`)
}

const spec = targets[target]
let payload
let extra = ''
try {
  if (target === 'public') {
    payload = sanitizePublicData(raw)
  } else if (raw && raw.type === 'namori-diary-review') {
    validateReviewExport(raw)
    if (!fs.existsSync(spec.file)) {
      fail('尚无 data/userdata.json，请先导入完整审核数据，再导入审核导出文件')
    }
    const base = JSON.parse(fs.readFileSync(spec.file, 'utf8'))
    const result = applyReviewExport(base, raw)
    payload = result.data
    extra = `，合并审核记录 ${result.applied} 条`
  } else {
    payload = validateUserData(raw)
  }
} catch (error) {
  fail(`数据校验失败，未写入任何文件：${error.message}`)
}

const text = `${JSON.stringify(payload, null, 2)}\n`
const backup = backupExisting(spec.file, spec.label)
writeAtomic(spec.file, text)
const items = Object.keys(payload.items ?? {}).length
console.log(
  `[import:data] 已写入 data/${path.basename(spec.file)}（${items} 条${extra}，${Buffer.byteLength(text)} 字节）`,
)
console.log(`[import:data] 备份：${backup ?? '无旧文件'}`)
