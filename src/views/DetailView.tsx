import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { navigate, closeItem } from '../lib/router'
import { formatFullDate, formatMonthDay, weekdayLabel } from '../lib/dates'
import { similarItems } from '../lib/filtering'
import { studyFields, EMPTY_STUDY } from '../lib/constants'
import { CharacterAvatar } from '../components/CharacterAvatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { DateEditor } from '../components/DateEditor'
import { TagPicker, TagPill } from '../components/TagPicker'
import { CharacterPicker } from '../components/CharacterPicker'
import { formatBytes, originalUrl } from '../lib/image'
import { extractShareUrl } from '../lib/utils'
import { IS_PUBLIC } from '../lib/appMode'
import { moveFilesToTrash } from '../lib/trash'
import type { DiaryItem, ExternalLinkKind, StudyNotes, Translation } from '../types'

const BASE = import.meta.env.BASE_URL

type Tab = 'info' | 'translate' | 'study'

export function DetailView({ itemId }: { itemId: string }) {
  const {
    itemMap,
    items,
    excludedItems,
    annotations,
    tagMap,
    collections,
    getDate,
    toggleFavorite,
    setReviewStatus,
    setNote,
    setItemLink,
    setStudy,
    setTranslation,
    setItemTags,
    toggleTagOnItem,
    addToCollection,
    deleteItems,
    notify,
  } = useStore()

  const item = itemMap.get(itemId)
  const [tab, setTab] = useState<Tab>('info')
  const [loaded, setLoaded] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [grid, setGrid] = useState(false)
  const [gray, setGray] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [linkDrafts, setLinkDrafts] = useState<Record<ExternalLinkKind, string>>({
    xiaohongshu: '',
    wechat: '',
  })
  const [studyDraft, setStudyDraft] = useState<StudyNotes>(EMPTY_STUDY)

  const annotation = item ? annotations[item.id] : undefined
  const date = item ? getDate(item) : null
  const reviewStatus = annotation?.excluded ? 'not_diary' : annotation?.reviewed ? 'diary' : 'pending'
  const itemTags = (annotation?.tags ?? []).map((id) => tagMap.get(id)).filter(Boolean)
  const itemCharacters = itemTags.filter((tag) => tag!.dimensionId === 'character')
  const characterIds = (annotation?.tags ?? []).filter((id) => tagMap.get(id)?.dimensionId === 'character')
  const otherTagIds = (annotation?.tags ?? []).filter((id) => tagMap.get(id)?.dimensionId !== 'character')


  const ordered = useMemo(
    () =>
      [...(annotation?.excluded ? excludedItems : items)].sort(
        (a, b) =>
          getDate(a).iso.localeCompare(getDate(b).iso) || a.postIndex - b.postIndex,
      ),
    [items, excludedItems, annotation?.excluded, getDate],
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
    setLinkDrafts({
      xiaohongshu: annotation?.xiaohongshu ?? '',
      wechat: annotation?.wechat ?? '',
    })
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

  const saveLink = (kind: ExternalLinkKind, raw: string) => {
    if (!item) return
    const value = raw.trim()
    if (!value) {
      setItemLink(item.id, kind, '')
      setLinkDrafts((drafts) => ({ ...drafts, [kind]: '' }))
      return
    }
    const url = extractShareUrl(value, kind)
    if (!url) {
      notify(kind === 'xiaohongshu' ? '未识别到小红书链接，请粘贴分享链接' : '未识别到公众号链接，请粘贴文章链接', 'error')
      return
    }
    setItemLink(item.id, kind, url)
    setLinkDrafts((drafts) => ({ ...drafts, [kind]: url }))
  }

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
    for (const field of studyFields()) {
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
          <a className="btn btn-sm btn-primary" href={originalUrl(item)} download={item.file} title="下载未经压缩的原始 JPG">
            <Icon name="download" size={14} />
            下载原图
          </a>
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
                alt={`Namori 水母绘日记 ${date.iso} 手绘插画`}
                onLoad={() => setLoaded(true)}
                style={{ opacity: loaded ? 1 : 0 }}
              />
              {grid && <div className="media-grid" />}
            </div>
          </div>

          <aside className="detail-side">
            {!IS_PUBLIC && annotation?.excluded && (
              <div className="excluded-notice">
                这张已确认为「非绘日记」，默认不会出现在图库、日历和统计中；原始 JPG 仍完整保留。
              </div>
            )}
            <div className="detail-date-block">
              {IS_PUBLIC && !date.confirmed ? (
                <div className="detail-date-main">
                  <span className="faint">日期未标注</span>
                </div>
              ) : (
                <>
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
                    {!IS_PUBLIC && (
                      <span className={`badge ${reviewStatus === 'diary' ? 'badge-sage' : reviewStatus === 'not_diary' ? 'badge-warn' : 'badge-accent'}`}>
                        {reviewStatus === 'diary' ? '已确认绘日记' : reviewStatus === 'not_diary' ? '非绘日记' : '类型待确认'}
                      </span>
                    )}
                  </div>
                </>
              )}
              <div className="detail-published faint">
                发布于 {formatFullDate(item.publishedAt)}
                {item.postCount > 1 && ` · 第 ${item.postIndex + 1}/${item.postCount} 张`}
              </div>
            </div>

            <div className="detail-actions">
              {!IS_PUBLIC && (
                <>
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
                  <button className="btn btn-danger-ghost" onClick={() => setDeleteOpen(true)}>
                    <Icon name="trash" size={15} />
                    删除
                  </button>
                </>
              )}
              {!IS_PUBLIC && (
                <>
                  <button
                    className={`btn${reviewStatus === 'diary' ? '' : ' btn-primary'}`}
                    disabled={reviewStatus === 'diary'}
                    onClick={() => {
                      setReviewStatus([item.id], 'diary')
                      notify('已确认为绘日记，原始图片保持不变', 'success')
                    }}
                  >
                    <Icon name="check" size={15} />
                    {reviewStatus === 'diary' ? '已确认绘日记' : '是绘日记'}
                  </button>
                  <button
                    className={`btn${reviewStatus === 'not_diary' ? '' : ' btn-danger-ghost'}`}
                    onClick={() => {
                      const nextStatus = reviewStatus === 'not_diary' ? 'pending' : 'not_diary'
                      setReviewStatus([item.id], nextStatus)
                      notify(nextStatus === 'pending' ? '已移回待确认，图片重新显示' : '已确认为非绘日记，原始图片仍保留', 'success')
                    }}
                  >
                    <Icon name={reviewStatus === 'not_diary' ? 'right' : 'close'} size={15} />
                    {reviewStatus === 'not_diary' ? '移回待确认' : '非绘日记'}
                  </button>
                </>
              )}
            </div>

            <div className="detail-tabs">
              <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
                信息
              </button>
              <button className={tab === 'translate' ? 'active' : ''} onClick={() => setTab('translate')}>
                翻译
                {annotation?.translation?.slots?.some((s) => s.text.trim()) && <span className="tab-dot" />}
              </button>
              {!IS_PUBLIC && (
                <button className={tab === 'study' ? 'active' : ''} onClick={() => setTab('study')}>
                  拆解笔记
                </button>
              )}
            </div>

            <div className="detail-scroll">
              {tab === 'info' && (
                <>
                  <section className="detail-section">
                    <div className="section-head">
                      <h4>原文案</h4>
                      <span className="faint">Instagram</span>
                    </div>
                    {item.caption ? (
                      <p className="caption-text">{item.caption}</p>
                    ) : (
                      <span className="faint">
                        {item.caption === ''
                          ? '这条帖子没有文案。'
                          : '未找到这条帖子的原文案（导入时可能缺少元数据）。'}
                      </span>
                    )}
                    {item.permalink && (
                      <a
                        className="btn btn-sm btn-ghost caption-link"
                        href={item.permalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        在 Instagram 查看原帖<Icon name="right" size={12} />
                      </a>
                    )}
                  </section>

                  {(annotation?.xiaohongshu || annotation?.wechat) && (
                    <section className="detail-section">
                      <div className="section-head">
                        <h4>其他平台</h4>
                      </div>
                      <div className="row row-wrap" style={{ gap: 6 }}>
                        {annotation?.xiaohongshu && (
                          <a
                            className="btn btn-sm btn-ghost"
                            href={annotation.xiaohongshu}
                            target="_blank"
                            rel="noreferrer"
                          >
                            小红书<Icon name="right" size={12} />
                          </a>
                        )}
                        {annotation?.wechat && (
                          <a
                            className="btn btn-sm btn-ghost"
                            href={annotation.wechat}
                            target="_blank"
                            rel="noreferrer"
                          >
                            微信公众号<Icon name="right" size={12} />
                          </a>
                        )}
                      </div>
                    </section>
                  )}

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>标签</h4>
                      {!IS_PUBLIC && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setTagOpen((v) => !v)}>
                          {tagOpen ? '收起' : '编辑'}
                        </button>
                      )}
                    </div>
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      {itemTags.map((tag) => (
                        <TagPill
                          key={tag!.id}
                          tag={tag!}
                          onRemove={IS_PUBLIC ? undefined : () => toggleTagOnItem(item.id, tag!.id)}
                        />
                      ))}
                      {!itemTags.length && <span className="faint">还没有标签</span>}
                    </div>
                    {!IS_PUBLIC && tagOpen && (
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
                      <h4>出场人物</h4>
                      {itemCharacters.length > 0 && <span className="faint">{itemCharacters.length} 位</span>}
                    </div>
                    {itemCharacters.length ? (
                      <div className="character-strip">
                        {itemCharacters.map((tag) => (
                          <button
                            key={tag!.id}
                            className="character-chip"
                            onClick={() => navigate(`/gallery?tag=${tag!.id}`)}
                            title={`查看 ${tag!.name} 的全部作品`}
                          >
                            <CharacterAvatar tagId={tag!.id} />
                            <span>{tag!.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="faint">
                        {IS_PUBLIC ? '这张图还没有标注出场人物。' : '还没有标注人物，在下方点选角色即可。'}
                      </span>
                    )}
                    {!IS_PUBLIC && (
                      <div className="character-picker-wrap">
                        <CharacterPicker
                          selected={characterIds}
                          onChange={(ids) => setItemTags(item.id, [...otherTagIds, ...ids])}
                        />
                      </div>
                    )}
                  </section>

                  {!IS_PUBLIC && (
                    <>
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
                          <h4>同步链接</h4>
                          <span className="faint">粘贴分享文案即可自动提取</span>
                        </div>
                        <div className="link-field">
                          <span className="field-label">小红书链接</span>
                          <div className="link-input-row">
                            <input
                              className="input"
                              value={linkDrafts.xiaohongshu}
                              placeholder="粘贴小红书分享文案或链接"
                              onChange={(e) =>
                                setLinkDrafts((drafts) => ({ ...drafts, xiaohongshu: e.target.value }))
                              }
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (!extractShareUrl(text, 'xiaohongshu')) return
                                e.preventDefault()
                                saveLink('xiaohongshu', text)
                              }}
                              onBlur={(e) => saveLink('xiaohongshu', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
                            {linkDrafts.xiaohongshu && (
                              <button className="btn btn-ghost btn-sm" onClick={() => saveLink('xiaohongshu', '')}>
                                清空
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="link-field">
                          <span className="field-label">公众号链接</span>
                          <div className="link-input-row">
                            <input
                              className="input"
                              value={linkDrafts.wechat}
                              placeholder="粘贴公众号文章链接"
                              onChange={(e) => setLinkDrafts((drafts) => ({ ...drafts, wechat: e.target.value }))}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (!extractShareUrl(text, 'wechat')) return
                                e.preventDefault()
                                saveLink('wechat', text)
                              }}
                              onBlur={(e) => saveLink('wechat', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
                            {linkDrafts.wechat && (
                              <button className="btn btn-ghost btn-sm" onClick={() => saveLink('wechat', '')}>
                                清空
                              </button>
                            )}
                          </div>
                        </div>
                      </section>
                    </>
                  )}

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

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>原图与出处</h4>
                      <span className="faint">原始 JPG · {formatBytes(item.bytes)}</span>
                    </div>
                    <div className="original-actions">
                      <a className="btn btn-primary btn-sm" href={originalUrl(item)} download={item.file}>
                        <Icon name="download" size={14} />下载原图
                      </a>
                      <a className="btn btn-sm" href={originalUrl(item)} target="_blank" rel="noreferrer">
                        <Icon name="expand" size={14} />查看原图
                      </a>
                      {item.permalink && (
                        <a className="btn btn-sm btn-ghost" href={item.permalink} target="_blank" rel="noreferrer">
                          Instagram 原帖<Icon name="right" size={12} />
                        </a>
                      )}
                    </div>
                  </section>

                  <section className="detail-section meta-list">
                    <div className="section-head">
                      <h4>图片信息</h4>
                      <span className={`badge ${date.confirmed ? 'badge-sage' : 'badge-warn'}`}>
                        {date.source === 'manual' ? '手动日期' : date.source === 'published' ? '沿用发布日' : '推断日期'}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>日记日期</span>
                      <span className="num">{date.iso} · {weekdayLabel(date.iso)}</span>
                    </div>
                    <div className="meta-row">
                      <span>发布日期</span>
                      <span className="num">{item.publishedAt}</span>
                    </div>
                    <div className="meta-row">
                      <span>原图尺寸</span>
                      <span className="num">{item.w} × {item.h} px</span>
                    </div>
                    <div className="meta-row">
                      <span>文件大小</span>
                      <span className="num">{formatBytes(item.bytes)}</span>
                    </div>
                    <div className="meta-row">
                      <span>同帖图片</span>
                      <span className="num">第 {item.postIndex + 1} / {item.postCount} 张</span>
                    </div>
                    <div className="meta-row">
                      <span>Shortcode</span>
                      <span className="num">{item.shortcode}</span>
                    </div>
                    <div className="meta-row">
                      <span>原始文件名</span>
                      <span className="num meta-file">{item.sourceFile ?? '未记录'}</span>
                    </div>
                    <div className="meta-row">
                      <span>导入后文件名</span>
                      <span className="num meta-file">{item.file}</span>
                    </div>
                    <div className="meta-row">
                      <span>推断日记日</span>
                      <span className="num">
                        {item.inferredYear}-{String(item.inferredMonth).padStart(2, '0')}-
                        {String(item.inferredDay).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                      发布日期来自帖子元数据；文件名是导入时按发布日期重命名的，原始 CDN 文件名保留在上方。
                    </div>
                  </section>
                </>
              )}

              {tab === 'translate' && (
                <TranslationPanel
                  item={item}
                  value={annotation?.translation}
                  onChange={(next) => setTranslation(item.id, next)}
                  onNotify={notify}
                  readOnly={IS_PUBLIC}
                />
              )}

              {tab === 'study' && (
                <>
                  <div className="study-intro">
                    把这张画拆成可模仿的步骤，记下构图、配色与线条的处理方式。
                  </div>
                  {studyFields().map((field) => (
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
            </div>
          </aside>
        </div>
      </div>

      {!IS_PUBLIC && deleteOpen && (
        <Modal title="删除这张图？" onClose={() => setDeleteOpen(false)}>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            确认后会立即从图库、索引和公开数据中移除，并把原图移入
            <code> images/_trash/</code> 保留恢复入口。底部提示条可短时间撤销；
            彻底清理需在本地管理端执行（<code>npm run dev</code> 的「待清理」或 <code>npm run purge</code>），
            清理后不可恢复。
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-danger-ghost"
              onClick={async () => {
                const moved = await moveFilesToTrash([item.file])
                deleteItems([item.id])
                notify(
                  moved
                    ? '已移入回收站，可在底部提示条撤销'
                    : '已从所有视图移除；原图清理需在本地管理端执行（npm run dev）',
                  'success',
                )
                setDeleteOpen(false)
                closeItem()
              }}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}

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
              创建一个，比如「临摹参考」「场景分组」。
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

const DEFAULT_TRANSLATION_SLOTS = [
  { lang: 'zh', label: '中文' },
  { lang: 'en', label: 'English' },
]

function TranslationPanel({
  item,
  value,
  onChange,
  onNotify,
  readOnly = false,
}: {
  item: DiaryItem
  value?: Translation
  onChange: (next: Translation | null) => void
  onNotify: (text: string, tone?: 'default' | 'success' | 'error') => void
  readOnly?: boolean
}) {
  const [source, setSource] = useState(value?.source ?? '')
  const [slots, setSlots] = useState(
    value?.slots?.length ? value.slots : DEFAULT_TRANSLATION_SLOTS.map((s) => ({ ...s, text: '' })),
  )
  const [draftOpen, setDraftOpen] = useState(false)
  const draft = value?.sourceDraft ?? ''

  useEffect(() => {
    setSource(value?.source ?? '')
    setSlots(
      value?.slots?.length ? value.slots : DEFAULT_TRANSLATION_SLOTS.map((s) => ({ ...s, text: '' })),
    )
    setDraftOpen(false)
  }, [item.id])

  const translated = slots.some((s) => s.text.trim())
  const save = () => {
    if (!source.trim() && !translated) {
      onChange(null)
      onNotify('已清空这张图的翻译', 'success')
      return
    }
    onChange({ source, slots, sourceDraft: draft || undefined, updatedAt: new Date().toISOString() })
    onNotify('翻译已保存', 'success')
  }

  const addSlot = () => {
    const existing = new Set(slots.map((s) => s.lang))
    const nextLang = ['zh', 'en', 'ko', 'fr', 'ja'].find((l) => !existing.has(l)) ?? `lang${slots.length + 1}`
    const label = nextLang === 'zh' ? '中文' : nextLang === 'en' ? 'English' : nextLang === 'ko' ? '한국어' : nextLang === 'fr' ? 'Français' : '日本語'
    setSlots((prev) => [...prev, { lang: nextLang, label, text: '' }])
  }

  return (
    <div className="translation-panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`badge ${translated ? 'badge-sage' : 'badge-accent'}`}>
          {translated ? '已翻译' : '未翻译'}
        </span>
        {!readOnly && (
          <button className="btn btn-primary btn-sm" onClick={save}>
            保存翻译
          </button>
        )}
      </div>

      <label className="translation-field">
        <span className="field-label">原文（日文）</span>
        <textarea
          className="textarea"
          placeholder="录入图上的日文原文；也可以从下方草稿填入后再校对"
          value={source}
          readOnly={readOnly}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>

      {!readOnly && draft && (
        <div className="translation-draft">
          <button className="btn btn-ghost btn-sm" onClick={() => setDraftOpen((v) => !v)}>
            {draftOpen ? '收起' : '查看'}原文草稿
          </button>
          {draftOpen && (
            <>
              <div className="draft-text">{draft}</div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSource((prev) => (prev ? `${prev}\n${draft}` : draft))}
              >
                填入原文
              </button>
            </>
          )}
        </div>
      )}

      {slots.map((slot, index) => (
        <label key={`${slot.lang}-${index}`} className="translation-field">
          <span className="row" style={{ justifyContent: 'space-between' }}>
            <span className="field-label">{slot.label}</span>
            {!readOnly && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
                type="button"
              >
                移除语言
              </button>
            )}
          </span>
          <textarea
            className="textarea"
            placeholder={`${slot.label}译文`}
            value={slot.text}
            readOnly={readOnly}
            onChange={(e) =>
              setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, text: e.target.value } : s)))
            }
          />
        </label>
      ))}

      {!readOnly && (
        <button className="btn btn-sm" onClick={addSlot}>
          <Icon name="plus" size={13} />添加语言
        </button>
      )}
    </div>
  )
}
