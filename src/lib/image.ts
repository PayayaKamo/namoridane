import type { DiaryItem } from '../types'
import { Zip, ZipPassThrough } from 'fflate'
import { translate } from '../i18n/core'

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(translate('lib.imageLoadFailed', { src })))
    img.src = src
  })
  imageCache.set(src, promise)
  promise.catch(() => imageCache.delete(src))
  return promise
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function originalUrl(item: DiaryItem): string {
  return `${import.meta.env.BASE_URL}${item.original}`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 触发下载前确认的图片数量阈值 */
export const ZIP_CONFIRM_ITEM_COUNT = 40
/** 触发下载前确认的估算体积阈值（96 MB） */
export const ZIP_CONFIRM_BYTES = 96 * 1024 * 1024
/** 单个分卷的最大估算体积（100 MB），避免一次占用过多内存 */
const VOLUME_MAX_BYTES = 100 * 1024 * 1024
/** 单个分卷最多包含的图片数量 */
const VOLUME_MAX_ITEMS = 100
/** 流式打包时攒够这个大小就转成 Blob，交给浏览器管理内存 */
const BLOB_FLUSH_BYTES = 8 * 1024 * 1024

export interface ZipProgress {
  /** 已处理张数（含失败） */
  done: number
  total: number
  /** 当前分卷序号，从 1 开始 */
  volume: number
  volumes: number
}

export interface ZipFailure {
  file: string
  message: string
}

export interface ZipResult {
  packed: number
  failed: ZipFailure[]
  canceled: boolean
  volumes: number
}

export interface DownloadZipOptions {
  signal?: AbortSignal
  onProgress?: (progress: ZipProgress) => void
}

/** 估算打包后的体积：原图按 store 模式直接存放，只增加少量 ZIP 头开销 */
export function estimateZipBytes(items: DiaryItem[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.bytes) ? item.bytes : 0) + 128, 0)
}

/** 按体积与数量拆分分卷，保证单个压缩包不会过大 */
function splitVolumes(items: DiaryItem[]): DiaryItem[][] {
  const volumes: DiaryItem[][] = []
  let current: DiaryItem[] = []
  let currentBytes = 0

  for (const item of items) {
    const size = (Number.isFinite(item.bytes) ? item.bytes : 0) + 128
    if (current.length && (current.length >= VOLUME_MAX_ITEMS || currentBytes + size > VOLUME_MAX_BYTES)) {
      volumes.push(current)
      current = []
      currentBytes = 0
    }
    current.push(item)
    currentBytes += size
  }
  if (current.length) volumes.push(current)
  return volumes
}

/** 预计会产出多少个压缩包，供确认弹窗与进度展示使用 */
export function countZipVolumes(items: DiaryItem[]): number {
  return splitVolumes(items).length
}

/** 把 ZIP 输出分段落成 Blob，避免在 JS 堆里堆积完整的压缩结果 */
class ZipBlobSink {
  private blobs: Blob[] = []
  private chunks: Uint8Array<ArrayBuffer>[] = []
  private pendingBytes = 0

  push(chunk: Uint8Array<ArrayBuffer>): void {
    if (!chunk.byteLength) return
    this.chunks.push(chunk)
    this.pendingBytes += chunk.byteLength
    if (this.pendingBytes >= BLOB_FLUSH_BYTES) this.flush()
  }

  private flush(): void {
    if (!this.chunks.length) return
    this.blobs.push(new Blob(this.chunks))
    this.chunks = []
    this.pendingBytes = 0
  }

  toBlob(): Blob {
    this.flush()
    return new Blob(this.blobs, { type: 'application/zip' })
  }
}

/** 流式读取单张原图，网络中断时只影响这一张 */
async function readOriginal(item: DiaryItem, signal?: AbortSignal): Promise<Uint8Array[]> {
  const response = await fetch(originalUrl(item), { signal })
  if (!response.ok) throw new Error(translate('lib.originalLoadFailed', { file: item.file }))
  if (!response.body) return [new Uint8Array(await response.arrayBuffer())]

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return chunks
}

/** 边收边压：一次只持有一张原图，ZIP 输出分块转 Blob */
async function packVolume(
  items: DiaryItem[],
  signal: AbortSignal | undefined,
  onPacked: () => void,
  onFailed: (failure: ZipFailure) => void,
): Promise<Blob | null> {
  const sink = new ZipBlobSink()
  let zipError: Error | null = null
  const zip = new Zip((err, chunk) => {
    if (err) {
      zipError = err
      return
    }
    sink.push(chunk)
  })

  for (const item of items) {
    if (signal?.aborted) return null

    let chunks: Uint8Array[]
    try {
      chunks = await readOriginal(item, signal)
    } catch (error) {
      if (signal?.aborted) return null
      onFailed({ file: item.file, message: (error as Error).message || 'unknown error' })
      continue
    }

    if (signal?.aborted) return null
    const entry = new ZipPassThrough(item.file)
    zip.add(entry)
    if (!chunks.length) entry.push(new Uint8Array(0), true)
    else chunks.forEach((chunk, index) => entry.push(chunk, index === chunks.length - 1))
    if (zipError) throw zipError
    onPacked()
  }

  zip.end()
  if (zipError) throw zipError
  return sink.toBlob()
}

/**
 * 下载原始 JPG 并打包为 ZIP。
 * 全程异步、可取消、单张失败不中断；超大任务自动分卷，每卷完成即下载。
 */
export async function downloadOriginalsZip(
  items: DiaryItem[],
  options: DownloadZipOptions = {},
): Promise<ZipResult> {
  const { signal, onProgress } = options
  const volumes = splitVolumes(items)
  const total = items.length
  const failed: ZipFailure[] = []
  const stamp = new Date().toISOString().slice(0, 10)
  let done = 0
  let packed = 0

  onProgress?.({ done, total, volume: 1, volumes: volumes.length })

  for (let index = 0; index < volumes.length; index += 1) {
    const volume = volumes[index]
    const report = () => onProgress?.({ done, total, volume: index + 1, volumes: volumes.length })
    const packedBefore = packed

    const blob = await packVolume(
      volume,
      signal,
      () => {
        done += 1
        packed += 1
        report()
      },
      (failure) => {
        done += 1
        failed.push(failure)
        report()
      },
    )
    if (!blob) return { packed, failed, canceled: true, volumes: volumes.length }

    // 整卷都失败时不产出空压缩包，失败项仍在结果里汇总
    if (packed === packedBefore) continue

    const suffix = volumes.length > 1 ? `-part${index + 1}of${volumes.length}` : ''
    downloadBlob(blob, `namori-originals-${stamp}-${volume.length}${suffix}.zip`)
    // 分卷下载之间留出一点时间，给浏览器处理多个下载任务
    if (volumes.length > 1) await new Promise((resolve) => setTimeout(resolve, 350))
  }

  return { packed, failed, canceled: false, volumes: volumes.length }
}

/** 在任意图片上采样平均色，作为临时占位 */
export async function averageColorOf(src: string): Promise<string> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#e8e0d0'
  ctx.drawImage(img, 0, 0, 16, 16)
  const { data } = ctx.getImageData(0, 0, 16, 16)
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  const n = data.length / 4
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
