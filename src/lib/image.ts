import type { CropParams, DiaryItem } from '../types'
import { zipSync } from 'fflate'
import { clamp } from './utils'

export function defaultCrop(): CropParams {
  return { cx: 0.5, cy: 0.5, size: 1, tolerance: 16, transparent: true }
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图片加载失败：${src}`))
    img.src = src
  })
  imageCache.set(src, promise)
  promise.catch(() => imageCache.delete(src))
  return promise
}

/** 计算裁切框在原图中的像素区域（始终为正方形） */
export function cropRect(img: { width: number; height: number }, crop: CropParams) {
  const side = Math.min(img.width, img.height) * clamp(crop.size, 0.1, 1)
  const cx = clamp(crop.cx, 0, 1) * img.width
  const cy = clamp(crop.cy, 0, 1) * img.height
  let x = cx - side / 2
  let y = cy - side / 2
  x = clamp(x, 0, img.width - side)
  y = clamp(y, 0, img.height - side)
  return { x, y, side }
}

/** 白底转透明：容差越大，被判为背景的像素越多 */
function whitenToTransparent(ctx: CanvasRenderingContext2D, width: number, height: number, tolerance: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const cutoff = 255 - clamp(tolerance, 0, 100) * 1.15
  const soft = 26
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const brightness = Math.max(r, g, b)
    const minChannel = Math.min(r, g, b)
    // 接近白色的纯背景直接透明；边缘保留半透明过渡，减轻锯齿
    if (minChannel >= cutoff) {
      data[i + 3] = 0
    } else if (brightness >= cutoff - soft && minChannel >= cutoff - soft) {
      const ratio = (cutoff - minChannel) / soft
      data[i + 3] = Math.round(clamp(ratio, 0, 1) * 255)
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

export function renderSticker(
  img: HTMLImageElement,
  crop: CropParams,
  size: number,
  transparent = crop.transparent,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas
  const { x, y, side } = cropRect(img, crop)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, x, y, side, side, 0, 0, size, size)
  if (transparent) whitenToTransparent(ctx, size, size, crop.tolerance)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))),
      type,
      type === 'image/webp' ? 0.92 : undefined,
    )
  })
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
    if (!response.ok) throw new Error(`原图读取失败：${item.file}`)
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
