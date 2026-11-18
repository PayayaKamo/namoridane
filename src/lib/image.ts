import type { DiaryItem } from '../types'
import { zipSync } from 'fflate'
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

/** 顺序读取原始 JPG 并无压缩打包，避免 JPG 二次压缩浪费 CPU */
export async function downloadOriginalsZip(
  items: DiaryItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  for (const item of items) {
    const response = await fetch(originalUrl(item))
    if (!response.ok) throw new Error(translate('lib.originalLoadFailed', { file: item.file }))
    files[item.file] = new Uint8Array(await response.arrayBuffer())
    onProgress?.(Object.keys(files).length, items.length)
  }
  const zipped = zipSync(files, { level: 0 })
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(
    new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }),
    `namori-originals-${stamp}-${items.length}.zip`,
  )
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
