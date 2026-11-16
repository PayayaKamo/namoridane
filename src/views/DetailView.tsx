import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { navigate, closeItem } from '../lib/router'
import { formatFullDate, formatMonthDay, weekdayLabel } from '../lib/dates'
import { similarItems } from '../lib/filtering'
import { STUDY_FIELDS, EMPTY_STUDY } from '../lib/constants'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { DateEditor } from '../components/DateEditor'
import { TagPicker, TagPill } from '../components/TagPicker'
import { StickerEditor } from '../components/StickerEditor'
import type { StudyNotes } from '../types'

const BASE = import.meta.env.BASE_URL

type Tab = 'info' | 'study' | 'sticker'

export function DetailView({ itemId }: { itemId: string }) {
  const {
    itemMap,
    items,
    annotations,
    tagMap,
    collections,
    getDate,
    toggleFavorite,
    setNote,
    setStudy,
    setItemTags,
    toggleTagOnItem,
    addToCollection,
    notify,
  } = useStore()

  const item = itemMap.get(itemId)
  const [tab, setTab] = useState<Tab>('info')
  const [loaded, setLoaded] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [grid, setGrid] = useState(false)
  const [gray, setGray] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [studyDraft, setStudyDraft] = useState<StudyNotes>(EMPTY_STUDY)

  const annotation = item ? annotations[item.id] : undefined
  const date = item ? getDate(item) : null
  const itemTags = (annotation?.tags ?? []).map((id) => tagMap.get(id)).filter(Boolean)

  const ordered = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          getDate(a).iso.localeCompare(getDate(b).iso) || a.postIndex - b.postIndex,
      ),
    [items, getDate],
  )
  const index = item ? ordered.findIndex((i) => i.id === item.id) : -1
  const prevItem = index > 0 ? ordered[index - 1] : null
  const nextItem = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null

  const similar = useMemo(
    () => (item ? similarItems(item, items, annotations, 8) : []),
    [item, items, annotations],
  )

  useEffect(() => {
    setLoaded(false)
    setTagOpen(false)
    setCompareOpen(false)
    setCompareId(null)
  }, [itemId])

  useEffect(() => {
    setNoteDraft(annotation?.note ?? '')
    setStudyDraft(annotation?.study ? { ...EMPTY_STUDY, ...annotation.study } : EMPTY_STUDY)
    // 仅在切换作品时重置草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  // 备注自动保存
  useEffect(() => {
    if (!item) return
    if (noteDraft === (annotation?.note ?? '')) return
    const timer = setTimeout(() => setNote(item.id, noteDraft), 500)
    return () => clearTimeout(timer)
  }, [noteDraft, item, annotation?.note, setNote])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || compareOpen || collectionOpen) return
      if (e.key === 'Escape') {
        closeItem()
      } else if (e.key === 'ArrowLeft' && prevItem) {
        e.preventDefault()
        navigate(`/item/${prevItem.id}`)
      } else if (e.key === 'ArrowRight' && nextItem) {
        e.preventDefault()
        navigate(`/item/${nextItem.id}`)
      } else if (e.key.toLowerCase() === 'f' && item) {
        toggleFavorite([item.id])
      } else if (e.key === '1') {
        setTab('info')
      } else if (e.key === '2') {
        setTab('study')
      } else if (e.key === '3') {
        setTab('sticker')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevItem, nextItem, item, toggleFavorite, compareOpen, collectionOpen])

  if (!item || !date) {
    return (
      <div className="detail-overlay">
        <div className="detail-missing">
          <p>找不到这张作品。</p>
          <button className="btn" onClick={closeItem}>
            返回
          </button>
        </div>
      </div>
    )
  }

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/item/${item.id}`
    try {
      await navigator.clipboard.writeText(url)
      notify('分享链接已复制（含作品标签信息）', 'success')
    } catch {
      notify(`链接：${url}`, 'default')
    }
  }

  const saveStudy = () => {
    if (!annotation?.study) {
      setStudy(item.id, studyDraft)
      return
    }
    for (const field of STUDY_FIELDS) {
      if ((annotation.study[field.key] ?? '') !== studyDraft[field.key]) {
        setStudy(item.id, { [field.key]: studyDraft[field.key] })
      }
    }
  }

  const compareItem = compareId ? itemMap.get(compareId) : null

  return (
    <div className="detail-overlay">
      <div className="detail-shell">
        <div className="detail-topbar">
          <button className="btn btn-ghost btn-sm" onClick={closeItem}>
            <Icon name="close" size={15} />
            关闭
          </button>
          <span className="detail-position num">
            {index + 1} / {ordered.length}
          </span>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" onClick={() => prevItem && navigate(`/item/${prevItem.id}`)} disabled={!prevItem} title="上一张（←）">
              <Icon name="left" />
            </button>
            <button className="icon-btn" onClick={() => nextItem && navigate(`/item/${nextItem.id}`)} disabled={!nextItem} title="下一张（→）">
              <Icon name="right" />
            </button>
          </div>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={share}>
            <Icon name="share" size={14} />
            分享链接
          </button>
          <button className="btn btn-sm" onClick={() => navigate(`/reader?start=${item.id}`)}>
            <Icon name="book" size={14} />
            翻阅模式
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-media">
            <div className="media-toolbar">
              <button className={`icon-btn${grid ? ' active' : ''}`} onClick={() => setGrid((v) => !v)} title="网格参考线">
                <Icon name="grid" size={16} />
              </button>
              <button className={`icon-btn${gray ? ' active' : ''}`} onClick={() => setGray((v) => !v)} title="灰度查看">
                <Icon name="contrast" size={16} />
              </button>
              <button className={`icon-btn${mirror ? ' active' : ''}`} onClick={() => setMirror((v) => !v)} title="水平镜像">
                <Icon name="mirror" size={16} />
              </button>
              <button className="icon-btn" onClick={() => setCompareOpen(true)} title="并排对比">
                <Icon name="compare" size={16} />
              </button>
            </div>
            <div className="media-stage" style={{ background: item.color }}>
              {!loaded && <div className="skeleton media-skeleton" />}
              <img
                key={item.id}
                className={`detail-img${gray ? ' gray' : ''}${mirror ? ' mirror' : ''}`}
                src={`${BASE}${item.large}`}
                alt={`绘日记 ${date.iso}`}
                onLoad={() => setLoaded(true)}
                style={{ opacity: loaded ? 1 : 0 }}
              />
              {grid && <div className="media-grid" />}
            </div>
          </div>

          <aside className="detail-side">
            <div className="detail-date-block">
              <div className="detail-date-main">
                <span className="hand detail-day">
                  {date.month} <i>/</i> {date.day}
                </span>
                <span className="detail-year num">{date.year}</span>
              </div>
              <div className="detail-date-sub">
                <span>{weekdayLabel(date.iso)}</span>
                <span className={`badge ${date.confirmed ? 'badge-sage' : 'badge-warn'}`}>
                  {date.confirmed ? '日期已确认' : '日期待校对'}
                </span>
              </div>
              <div className="detail-published faint">
                发布于 {formatFullDate(item.publishedAt)}
                {item.postCount > 1 && ` · 第 ${item.postIndex + 1}/${item.postCount} 张`}
              </div>
            </div>

            <div className="detail-actions">
              <button
                className={`btn${annotation?.favorite ? ' btn-primary' : ''}`}
                onClick={() => toggleFavorite([item.id])}
              >
                <Icon name={annotation?.favorite ? 'heartFill' : 'heart'} size={15} />
                {annotation?.favorite ? '已收藏' : '收藏'}
              </button>
              <button className="btn" onClick={() => setCollectionOpen(true)}>
                <Icon name="folder" size={15} />
                加入合集
              </button>
              <button className="btn" onClick={() => setTab('sticker')}>
                <Icon name="sticker" size={15} />
                表情包
              </button>
            </div>

            <div className="detail-tabs">
              <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
                信息
              </button>
              <button className={tab === 'study' ? 'active' : ''} onClick={() => setTab('study')}>
                拆解笔记
              </button>
              <button className={tab === 'sticker' ? 'active' : ''} onClick={() => setTab('sticker')}>
                表情包
              </button>
            </div>

            <div className="detail-scroll">
              {tab === 'info' && (
                <>
                  <section className="detail-section">
                    <div className="section-head">
                      <h4>标签</h4>
                      <button className="btn btn-ghost btn-sm" onClick={() => setTagOpen((v) => !v)}>
                        {tagOpen ? '收起' : '编辑'}
                      </button>
                    </div>
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      {itemTags.map((tag) => (
                        <TagPill
                          key={tag!.id}
                          tag={tag!}
                          onRemove={() => toggleTagOnItem(item.id, tag!.id)}
                        />
                      ))}
                      {!itemTags.length && <span className="faint">还没有标签</span>}
                    </div>
                    {tagOpen && (
                      <div className="tag-picker-wrap">
                        <TagPicker
                          selected={annotation?.tags ?? []}
                          onChange={(ids) => setItemTags(item.id, ids)}
                        />
                      </div>
                    )}
                  </section>

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>日期校对</h4>
                    </div>
                    <DateEditor item={item} compact />
                  </section>

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>备注</h4>
                      <span className="faint">自动保存</span>
                    </div>
                    <textarea
                      className="textarea"
                      placeholder="记录这张画的心情、出处或临时想法…"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      onBlur={() => setNote(item.id, noteDraft)}
                    />
                  </section>

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>主色板</h4>
                      <span className="faint">点击复制</span>
                    </div>
                    <div className="palette-row">
                      {item.palette.map((hex) => (
                        <button
                          key={hex}
                          className="swatch"
                          style={{ background: hex }}
                          title={hex}
                          onClick={() => {
                            navigator.clipboard?.writeText(hex)
                            notify(`已复制 ${hex}`, 'success')
                          }}
                        />
                      ))}
                    </div>
                    <div className="palette-hex-row">
                      {item.palette.map((hex) => (
                        <span key={hex} className="num">
                          {hex}
                        </span>
                      ))}
                    </div>
                  </section>

                  {similar.length > 0 && (
                    <section className="detail-section">
                      <div className="section-head">
                        <h4>相似作品</h4>
                        <span className="faint">标签 + 色板</span>
                      </div>
                      <div className="similar-grid">
                        {similar.map(({ item: s, shared }) => (
                          <button key={s.id} className="similar-item" onClick={() => navigate(`/item/${s.id}`)}>
                            <img src={`${BASE}${s.thumb}`} alt="" loading="lazy" />
                            {shared > 0 && <span className="similar-badge num">{shared} 标签</span>}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="detail-section meta-list">
                    <div className="meta-row">
                      <span>尺寸</span>
                      <span className="num">{item.w} × {item.h}</span>
                    </div>
                    <div className="meta-row">
                      <span>文件名</span>
                      <span className="num" style={{ fontSize: 11 }}>{item.file}</span>
                    </div>
                    <div className="meta-row">
                      <span>发布日</span>
                      <span className="num">{item.publishedAt}</span>
                    </div>
                    <div className="meta-row">
                      <span>推断日记日</span>
                      <span className="num">
                        {item.inferredYear}-{String(item.inferredMonth).padStart(2, '0')}-
                        {String(item.inferredDay).padStart(2, '0')}
                      </span>
                    </div>
                  </section>
                </>
              )}

              {tab === 'study' && (
                <>
                  <div className="study-intro">
                    把这张画拆成可模仿的步骤，记下构图、配色与线条的处理方式。
                  </div>
                  {STUDY_FIELDS.map((field) => (
                    <label key={field.key} className="study-field">
                      <span className="study-label">{field.label}</span>
                      <textarea
                        className="textarea"
                        placeholder={field.hint}
                        value={studyDraft[field.key]}
                        onChange={(e) => setStudyDraft((s) => ({ ...s, [field.key]: e.target.value }))}
                        onBlur={saveStudy}
                      />
                    </label>
                  ))}
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveStudy}>
                      保存笔记
                    </button>
                  </div>
                  <section className="detail-section">
                    <div className="section-head">
                      <h4>配色参考</h4>
                    </div>
                    <div className="palette-row">
                      {item.palette.map((hex) => (
                        <div key={hex} className="palette-block" style={{ background: hex }}>
                          <span style={{ color: '#fff' }}>{hex}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  {similar.length > 0 && (
                    <section className="detail-section">
                      <div className="section-head">
                        <h4>适合对照临摹</h4>
                      </div>
                      <div className="similar-grid">
                        {similar.slice(0, 6).map(({ item: s }) => (
                          <button key={s.id} className="similar-item" onClick={() => navigate(`/item/${s.id}`)}>
                            <img src={`${BASE}${s.thumb}`} alt="" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {tab === 'sticker' && <StickerEditor item={item} />}
            </div>
          </aside>
        </div>
      </div>

      {collectionOpen && (
        <Modal title="加入合集" onClose={() => setCollectionOpen(false)}>
          {collections.length ? (
            <div className="collection-pick-list">
              {collections.map((col) => {
                const inCol = col.itemIds.includes(item.id)
                return (
                  <button
                    key={col.id}
                    className="collection-pick"
                    onClick={() => {
                      addToCollection(col.id, [item.id])
                      notify(`已加入「${col.name}」`, 'success')
                      setCollectionOpen(false)
                    }}
                  >
                    <Icon name="folder" size={16} />
                    <span>{col.name}</span>
                    <span className="faint">{col.itemIds.length} 张</span>
                    {inCol && <Icon name="check" size={14} />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="muted" style={{ padding: '12px 0' }}>
              还没有合集，去
              <a href="#/collections" style={{ color: 'var(--accent)' }}> 合集页 </a>
              创建一个，比如「表情包素材」「临摹参考」。
            </div>
          )}
          <div className="modal-foot" style={{ padding: '14px 0 0', background: 'none' }}>
            <a className="btn btn-sm" href="#/collections">
              管理合集
            </a>
          </div>
        </Modal>
      )}

      {compareOpen && (
        <Modal title="并排对比" onClose={() => setCompareOpen(false)} wide>
          <div className="compare-pick">
            <span className="faint">选择另一张（按相似度推荐）</span>
            <div className="similar-grid">
              {similar.map(({ item: s }) => (
                <button
                  key={s.id}
                  className={`similar-item${compareId === s.id ? ' active' : ''}`}
                  onClick={() => setCompareId(s.id)}
                >
                  <img src={`${BASE}${s.thumb}`} alt="" />
                </button>
              ))}
              {prevItem && (
                <button
                  className={`similar-item${compareId === prevItem.id ? ' active' : ''}`}
                  onClick={() => setCompareId(prevItem.id)}
                >
                  <img src={`${BASE}${prevItem.thumb}`} alt="" />
                  <span className="similar-badge">上一张</span>
                </button>
              )}
            </div>
          </div>
          <div className="compare-stage">
            <figure>
              <img src={`${BASE}${item.large}`} alt="当前作品" className={mirror ? 'mirror' : ''} />
              <figcaption>当前 · {formatMonthDay(date.month, date.day)}</figcaption>
            </figure>
            <figure>
              {compareItem ? (
                <img
                  src={`${BASE}${compareItem.large}`}
                  alt="对比作品"
                  className={mirror ? 'mirror' : ''}
                />
              ) : (
                <div className="compare-empty">从上方选择一张作品</div>
              )}
              <figcaption>
                {compareItem
                  ? `${formatMonthDay(getDate(compareItem).month, getDate(compareItem).day)} · ${getDate(compareItem).year}`
                  : '对比'}
              </figcaption>
            </figure>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <label className="toggle-row">
              <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
              灰度
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
              镜像
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
