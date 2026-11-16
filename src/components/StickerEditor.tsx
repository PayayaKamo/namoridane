import { useEffect, useRef, useState } from 'react'
import type { DiaryItem } from '../types'
import { useStore } from '../state/store'
import {
  canvasToBlob,
  defaultCrop,
  downloadBlob,
  loadImage,
  renderSticker,
} from '../lib/image'
import { clamp } from '../lib/utils'
import { Icon } from './Icon'
import { STICKER_SIZES } from '../lib/constants'

const BASE = import.meta.env.BASE_URL

export function StickerEditor({ item }: { item: DiaryItem }) {
  const { annotations, setCrop, notify } = useStore()
  const crop = annotations[item.id]?.crop ?? defaultCrop()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [format, setFormat] = useState<'png' | 'webp'>('png')
  const [busy, setBusy] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    mode: 'move' | 'resize'
    startX: number
    startY: number
    cx: number
    cy: number
    size: number
  } | null>(null)

  useEffect(() => {
    let alive = true
    setImg(null)
    loadImage(`${BASE}${item.large}`)
      .then((image) => alive && setImg(image))
      .catch(() => alive && notify('大图加载失败', 'error'))
    return () => {
      alive = false
    }
  }, [item.large, notify])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const update = () => setStage({ w: node.clientWidth, h: node.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [img])

  // 预览
  useEffect(() => {
    if (!img || !previewRef.current) return
    const out = renderSticker(img, crop, 360)
    const canvas = previewRef.current
    canvas.width = 360
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 360, 360)
    ctx.drawImage(out, 0, 0)
  }, [img, crop])

  const side = Math.min(stage.w, stage.h) * crop.size
  const left = clamp(crop.cx * stage.w - side / 2, 0, Math.max(0, stage.w - side))
  const top = clamp(crop.cy * stage.h - side / 2, 0, Math.max(0, stage.h - side))

  const onPointerDown = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      cx: crop.cx,
      cy: crop.cy,
      size: crop.size,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !stage.w || !stage.h) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (drag.mode === 'move') {
      setCrop(item.id, {
        ...crop,
        cx: clamp(drag.cx + dx / stage.w, 0, 1),
        cy: clamp(drag.cy + dy / stage.h, 0, 1),
      })
    } else {
      const delta = (dx + dy) / 2 / Math.min(stage.w, stage.h)
      setCrop(item.id, { ...crop, size: clamp(drag.size + delta, 0.15, 1) })
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const exportSticker = async (size: number) => {
    if (!img) return
    setBusy(true)
    try {
      const canvas = renderSticker(img, crop, size)
      const mime = format === 'png' ? 'image/png' : 'image/webp'
      const blob = await canvasToBlob(canvas, mime)
      downloadBlob(blob, `${item.id}-sticker-${size}.${format}`)
      notify(`已导出 ${size}×${size} ${format.toUpperCase()}`, 'success')
    } catch {
      notify('导出失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sticker-editor">
      <div className="sticker-stage" ref={stageRef}>
        {img ? (
          <>
            <img src={`${BASE}${item.large}`} alt="" draggable={false} />
            <div
              className="crop-box"
              style={{ left, top, width: side, height: side }}
              onPointerDown={onPointerDown('move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="crop-grid" />
              <span className="crop-label">主体区域</span>
              <div
                className="crop-handle"
                onPointerDown={onPointerDown('resize')}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </div>
          </>
        ) : (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      <div className="sticker-preview-row">
        <div className="sticker-preview checker">
          <canvas ref={previewRef} width={360} height={360} />
        </div>
        <div className="sticker-hints">
          <p className="faint">拖动方框选主体，拖右下角缩放；预览为最终表情效果。</p>
          <div className="row row-wrap" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setCrop(item.id, { ...crop, cx: 0.5, cy: 0.5 })}>
              居中
            </button>
            <button className="btn btn-sm" onClick={() => setCrop(item.id, { ...crop, size: 1 })}>
              全图
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setCrop(item.id, defaultCrop())}>
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="sticker-controls">
        <label className="slider-row">
          <span>裁切范围</span>
          <input
            type="range"
            min={15}
            max={100}
            value={Math.round(crop.size * 100)}
            onChange={(e) => setCrop(item.id, { ...crop, size: Number(e.target.value) / 100 })}
          />
          <span className="num">{Math.round(crop.size * 100)}%</span>
        </label>
        <label className="slider-row">
          <span>去白容差</span>
          <input
            type="range"
            min={0}
            max={100}
            value={crop.tolerance}
            onChange={(e) => setCrop(item.id, { ...crop, tolerance: Number(e.target.value) })}
          />
          <span className="num">{crop.tolerance}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={crop.transparent}
            onChange={(e) => setCrop(item.id, { ...crop, transparent: e.target.checked })}
          />
          白底转透明
        </label>
      </div>

      <div className="sticker-export">
        <div className="segmented">
          <button className={format === 'png' ? 'active' : ''} onClick={() => setFormat('png')}>
            PNG
          </button>
          <button className={format === 'webp' ? 'active' : ''} onClick={() => setFormat('webp')}>
            WebP
          </button>
        </div>
        <div className="spacer" />
        {STICKER_SIZES.map((size) => (
          <button
            key={size}
            className="btn btn-primary btn-sm"
            disabled={!img || busy}
            onClick={() => exportSticker(size)}
          >
            <Icon name="download" size={13} />
            {size}×{size}
          </button>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 11 }}>
        裁切与去白参数会自动保存，下次打开可继续微调。
      </p>
    </div>
  )
}
