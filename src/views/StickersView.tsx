import { useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import type { Route } from '../lib/router'
import { navigate, openItem } from '../lib/router'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Modal'
import { STICKER_SIZES } from '../lib/constants'
import { canvasToBlob, defaultCrop, downloadBlob, loadImage, renderSticker } from '../lib/image'
import { IS_PUBLIC } from '../lib/appMode'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL

export function StickersView({ route }: { route: Route }) {
  const { items, annotations, collections, notify, setFavorite } = useStore()
  const initialIds = useMemo(
    () => (route.query.get('ids') ?? '').split(',').filter(Boolean),
    [route.query],
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds))
  const [collectionId, setCollectionId] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [size, setSize] = useState<number>(512)
  const [format, setFormat] = useState<'png' | 'webp'>('png')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const cropped = useMemo(
    () => items.filter((item) => annotations[item.id]?.crop).slice(0, 12),
    [items, annotations],
  )

  const pool = useMemo(() => {
    let base = items
    if (collectionId) {
      const col = collections.find((c) => c.id === collectionId)
      const ids = new Set(col?.itemIds ?? [])
      base = base.filter((i) => ids.has(i.id))
    }
    if (favoriteOnly) base = base.filter((i) => annotations[i.id]?.favorite)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      base = base.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.publishedAt.includes(q) ||
          (annotations[i.id]?.note ?? '').toLowerCase().includes(q),
      )
    }
    return base
  }, [items, collections, collectionId, favoriteOnly, keyword, annotations])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const exportBatch = async () => {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true)
    setProgress('准备中…')
    try {
      const mime = format === 'png' ? 'image/png' : 'image/webp'
      if (ids.length === 1) {
        const item = items.find((i) => i.id === ids[0])
        if (!item) return
        setProgress('渲染中…')
        const img = await loadImage(`${BASE}${item.large}`)
        const canvas = renderSticker(img, annotations[item.id]?.crop ?? defaultCrop(), size)
        const blob = await canvasToBlob(canvas, mime)
        downloadBlob(blob, `${item.id}-sticker-${size}.${format}`)
        notify('已导出 1 张表情包', 'success')
        return
      }
      const files: Record<string, Uint8Array> = {}
      let done = 0
      for (const id of ids) {
        const item = items.find((i) => i.id === id)
        if (!item) continue
        const img = await loadImage(`${BASE}${item.large}`)
        const canvas = renderSticker(img, annotations[id]?.crop ?? defaultCrop(), size)
        const blob = await canvasToBlob(canvas, mime)
        files[`${id}-${size}.${format}`] = new Uint8Array(await blob.arrayBuffer())
        done++
        setProgress(`${done} / ${ids.length}`)
      }
      setProgress('打包中…')
      const zipped = zipSync(files, { level: 6 })
      downloadBlob(new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }), `namori-stickers-${size}.zip`)
      notify(`已导出 ${ids.length} 张表情包（ZIP）`, 'success')
    } catch (err) {
      console.error(err)
      notify('导出失败，请减少选择数量后重试', 'error')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const selectedItems = useMemo(
    () => [...selected].map((id) => items.find((i) => i.id === id)).filter((x): x is DiaryItem => Boolean(x)),
    [selected, items],
  )

  return (
    <div className="stickers-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Sticker Studio</div>
          <h2 className="page-title">表情包工坊</h2>
          <div className="page-sub">
            纯前端 Canvas 处理：框选主体、白底转透明，导出方形 PNG / WebP，可批量打包 ZIP。
          </div>
        </div>
        <div className="page-actions">
          <span className="badge badge-accent">已选 {selected.size}</span>
        </div>
      </div>

      <div className="sticker-workbench">
        <section className="panel sticker-config">
          <div className="panel-head">
            <h3>导出设置</h3>
          </div>
          <div className="field">
            <div className="field-label">尺寸</div>
            <div className="segmented">
              {STICKER_SIZES.map((s) => (
                <button key={s} className={size === s ? 'active' : ''} onClick={() => setSize(s)}>
                  {s} × {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <div className="field-label">格式</div>
            <div className="segmented">
              <button className={format === 'png' ? 'active' : ''} onClick={() => setFormat('png')}>
                PNG
              </button>
              <button className={format === 'webp' ? 'active' : ''} onClick={() => setFormat('webp')}>
                WebP
              </button>
            </div>
          </div>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 12 }}>
            PNG 兼容性最好；WebP 体积更小。每张作品如已保存裁切参数会自动套用，否则默认居中全图。
          </p>
          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }} disabled={!selected.size || busy} onClick={exportBatch}>
            <Icon name="download" size={15} />
            {busy ? `导出中 ${progress}` : selected.size === 1 ? '导出这张' : `导出 ${selected.size} 张`}
          </button>
          <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(pool.map((i) => i.id)))}>
              全选当前
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
              清空
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setFavorite([...selected], true)
                notify('已收藏所选作品', 'success')
              }}
              disabled={!selected.size}
            >
              收藏所选
            </button>
          </div>

          {selectedItems.length > 0 && (
            <>
              <div className="divider" />
              <div className="selected-strip">
                {selectedItems.slice(0, 16).map((item) => (
                  <button key={item.id} className="selected-thumb" onClick={() => openItem(item.id)} title="打开详情精修裁切">
                    <img src={`${BASE}${item.thumb}`} alt="" />
                  </button>
                ))}
                {selectedItems.length > 16 && <span className="faint">+{selectedItems.length - 16}</span>}
              </div>
            </>
          )}
        </section>

        <section className="sticker-pool">
          <div className="gallery-toolbar" style={{ paddingTop: 0 }}>
            <div className="top-search" style={{ maxWidth: 260, marginLeft: 0 }}>
              <Icon name="search" size={14} />
              <input value={keyword} placeholder="搜索编号 / 日期 / 备注" onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <select className="select" style={{ width: 190 }} value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              <option value="">全部作品</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.itemIds.length}）
                </option>
              ))}
            </select>
            <button
              className={`chip${favoriteOnly ? ' active' : ''}`}
              onClick={() => setFavoriteOnly((v) => !v)}
            >
              <Icon name="heart" size={11} />
              只看收藏
            </button>
            <div className="spacer" />
            <span className="faint">{pool.length} 张可选</span>
          </div>

          {cropped.length > 0 && (
            <div className="cropped-strip">
              <span className="field-label">最近调整过裁切</span>
              <div className="row row-wrap" style={{ gap: 6, marginTop: 6 }}>
                {cropped.map((item) => (
                  <button key={item.id} className="chip" onClick={() => openItem(item.id)}>
                    <img src={`${BASE}${item.thumb}`} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />
                    {item.id.slice(0, 6)}…
                  </button>
                ))}
              </div>
            </div>
          )}

          {pool.length ? (
            <div className="sticker-grid">
              {pool.slice(0, 240).map((item) => {
                const active = selected.has(item.id)
                return (
                  <button
                    key={item.id}
                    className={`sticker-cell${active ? ' active' : ''}`}
                    onClick={() => toggle(item.id)}
                  >
                    <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" />
                    {active && (
                      <span className="sticker-check">
                        <Icon name="check" size={12} strokeWidth={2.6} />
                      </span>
                    )}
                    {annotations[item.id]?.crop && <span className="crop-mark">已裁</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <Empty icon="sticker" title="没有可导出的作品" hint="调整筛选条件，或先在图库里收藏一些喜欢的画。" />
          )}
          {pool.length > 240 && (
            <p className="faint" style={{ marginTop: 10 }}>
              为保持流畅，这里最多显示 240 张；用搜索或选集缩小范围。已选中的作品不受影响。
            </p>
          )}
        </section>
      </div>

      <div className="panel sticker-tip">
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="quick-icon">
            <Icon name="info" size={18} />
          </span>
          <div>
            <h3 style={{ fontSize: 15 }}>怎么做得更像表情包</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              打开任意作品 → 「表情包」标签页，可以拖动方框只框住脸部或主体，调整去白容差，实时预览透明底效果。
              裁切参数会按作品保存，批量导出时自动复用。之后在合集里建一个「表情包素材」，就能随时找回这些图。
            </p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              {!IS_PUBLIC && (
                <button className="btn btn-sm" onClick={() => navigate('/collections')}>
                  <Icon name="folder" size={13} />
                  管理合集
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => navigate('/gallery')}>
                去图库多选
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
