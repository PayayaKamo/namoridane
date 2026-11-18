import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { navigate, closeItem, siteHref } from '../lib/router'
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
import { useI18n } from '../i18n'
import type { DiaryItem, ExternalLinkKind, StudyNotes, Translation } from '../types'

const BASE = import.meta.env.BASE_URL

type Tab = 'info' | 'translate' | 'study'

export function DetailView({ itemId }: { itemId: string }) {
  const { t } = useI18n()
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
      notify(
        kind === 'xiaohongshu' ? t('detail.links.xiaohongshuInvalid') : t('detail.links.wechatInvalid'),
        'error',
      )
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
          <p>{t('detail.missing.title')}</p>
          <button className="btn" onClick={closeItem}>
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  const share = async () => {
    const url = `${window.location.origin}${siteHref(`/item/${item.id}/`)}`
    try {
      await navigator.clipboard.writeText(url)
      notify(t('detail.share.copied'), 'success')
    } catch {
      notify(t('detail.share.link', { url }), 'default')
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
            {t('common.close')}
          </button>
          <span className="detail-position num">
            {index + 1} / {ordered.length}
          </span>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" onClick={() => prevItem && navigate(`/item/${prevItem.id}`)} disabled={!prevItem} title={t('detail.topbar.prev')}>
              <Icon name="left" />
            </button>
            <button className="icon-btn" onClick={() => nextItem && navigate(`/item/${nextItem.id}`)} disabled={!nextItem} title={t('detail.topbar.next')}>
              <Icon name="right" />
            </button>
          </div>
          <div className="spacer" />
          <a className="btn btn-sm btn-primary" href={originalUrl(item)} download={item.file} title={t('detail.topbar.downloadTitle')}>
            <Icon name="download" size={14} />
            {t('detail.topbar.download')}
          </a>
          <button className="btn btn-sm btn-ghost" onClick={share}>
            <Icon name="share" size={14} />
            {t('detail.topbar.share')}
          </button>
          <button className="btn btn-sm" onClick={() => navigate(`/reader?start=${item.id}`)}>
            <Icon name="book" size={14} />
            {t('detail.topbar.reader')}
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-media">
            <div className="media-toolbar">
              <button className={`icon-btn${grid ? ' active' : ''}`} onClick={() => setGrid((v) => !v)} title={t('detail.media.grid')}>
                <Icon name="grid" size={16} />
              </button>
              <button className={`icon-btn${gray ? ' active' : ''}`} onClick={() => setGray((v) => !v)} title={t('detail.media.gray')}>
                <Icon name="contrast" size={16} />
              </button>
              <button className={`icon-btn${mirror ? ' active' : ''}`} onClick={() => setMirror((v) => !v)} title={t('detail.media.mirror')}>
                <Icon name="mirror" size={16} />
              </button>
              <button className="icon-btn" onClick={() => setCompareOpen(true)} title={t('detail.media.compare')}>
                <Icon name="compare" size={16} />
              </button>
            </div>
            <div className="media-stage" style={{ background: item.color }}>
              {!loaded && <div className="skeleton media-skeleton" />}
              <img
                key={item.id}
                className={`detail-img${gray ? ' gray' : ''}${mirror ? ' mirror' : ''}`}
                src={`${BASE}${item.large}`}
                alt={t('detail.media.imageAlt', { date: date.iso })}
                onLoad={() => setLoaded(true)}
                style={{ opacity: loaded ? 1 : 0 }}
              />
              {grid && <div className="media-grid" />}
            </div>
          </div>

          <aside className="detail-side">
            {!IS_PUBLIC && annotation?.excluded && (
              <div className="excluded-notice">{t('detail.excluded.notice')}</div>
            )}
            <div className="detail-date-block">
              {IS_PUBLIC && !date.confirmed ? (
                <div className="detail-date-main">
                  <span className="faint">{t('detail.date.unmarked')}</span>
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
                      {date.confirmed ? t('detail.date.confirmed') : t('detail.date.pending')}
                    </span>
                    {!IS_PUBLIC && (
                      <span className={`badge ${reviewStatus === 'diary' ? 'badge-sage' : reviewStatus === 'not_diary' ? 'badge-warn' : 'badge-accent'}`}>
                        {reviewStatus === 'diary'
                          ? t('detail.review.confirmed')
                          : reviewStatus === 'not_diary'
                            ? t('detail.review.notDiary')
                            : t('detail.review.pending')}
                      </span>
                    )}
                  </div>
                </>
              )}
              <div className="detail-published faint">
                {t('detail.date.published', { date: formatFullDate(item.publishedAt) })}
                {item.postCount > 1 &&
                  ` · ${t('detail.date.postPosition', {
                    index: item.postIndex + 1,
                    count: item.postCount,
                  })}`}
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
                    {annotation?.favorite ? t('detail.actions.favorited') : t('detail.actions.favorite')}
                  </button>
                  <button className="btn" onClick={() => setCollectionOpen(true)}>
                    <Icon name="folder" size={15} />
                    {t('detail.actions.addToCollection')}
                  </button>
                  <button className="btn btn-danger-ghost" onClick={() => setDeleteOpen(true)}>
                    <Icon name="trash" size={15} />
                    {t('common.delete')}
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
                      notify(t('detail.review.confirmedNotice'), 'success')
                    }}
                  >
                    <Icon name="check" size={15} />
                    {reviewStatus === 'diary' ? t('detail.review.confirmed') : t('detail.review.markDiary')}
                  </button>
                  <button
                    className={`btn${reviewStatus === 'not_diary' ? '' : ' btn-danger-ghost'}`}
                    onClick={() => {
                      const nextStatus = reviewStatus === 'not_diary' ? 'pending' : 'not_diary'
                      setReviewStatus([item.id], nextStatus)
                      notify(
                        nextStatus === 'pending'
                          ? t('detail.review.restoreNotice')
                          : t('detail.review.notDiaryNotice'),
                        'success',
                      )
                    }}
                  >
                    <Icon name={reviewStatus === 'not_diary' ? 'right' : 'close'} size={15} />
                    {reviewStatus === 'not_diary' ? t('detail.review.restore') : t('detail.review.notDiary')}
                  </button>
                </>
              )}
            </div>

            <div className="detail-tabs">
              <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
                {t('detail.tabs.info')}
              </button>
              <button className={tab === 'translate' ? 'active' : ''} onClick={() => setTab('translate')}>
                {t('detail.tabs.translation')}
                {annotation?.translation?.slots?.some((s) => s.text.trim()) && <span className="tab-dot" />}
              </button>
              {!IS_PUBLIC && (
                <button className={tab === 'study' ? 'active' : ''} onClick={() => setTab('study')}>
                  {t('detail.tabs.study')}
                </button>
              )}
            </div>

            <div className="detail-scroll">
              {tab === 'info' && (
                <>
                  <section className="detail-section">
                    <div className="section-head">
                      <h4>{t('detail.caption.title')}</h4>
                      <span className="faint">Instagram</span>
                    </div>
                    {item.caption ? (
                      <p className="caption-text">{item.caption}</p>
                    ) : (
                      <span className="faint">
                        {item.caption === ''
                          ? t('detail.caption.empty')
                          : t('detail.caption.missing')}
                      </span>
                    )}
                    {item.permalink && (
                      <a
                        className="btn btn-sm btn-ghost caption-link"
                        href={item.permalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('detail.caption.openOriginal')}<Icon name="right" size={12} />
                      </a>
                    )}
                  </section>

                  {(annotation?.xiaohongshu || annotation?.wechat) && (
                    <section className="detail-section">
                      <div className="section-head">
                        <h4>{t('detail.otherPlatforms.title')}</h4>
                      </div>
                      <div className="row row-wrap" style={{ gap: 6 }}>
                        {annotation?.xiaohongshu && (
                          <a
                            className="btn btn-sm btn-ghost"
                            href={annotation.xiaohongshu}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('detail.otherPlatforms.xiaohongshu')}<Icon name="right" size={12} />
                          </a>
                        )}
                        {annotation?.wechat && (
                          <a
                            className="btn btn-sm btn-ghost"
                            href={annotation.wechat}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('detail.otherPlatforms.wechat')}<Icon name="right" size={12} />
                          </a>
                        )}
                      </div>
                    </section>
                  )}

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>{t('common.tags')}</h4>
                      {!IS_PUBLIC && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setTagOpen((v) => !v)}>
                          {tagOpen ? t('common.collapse') : t('common.edit')}
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
                      {!itemTags.length && <span className="faint">{t('detail.tags.empty')}</span>}
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
                      <h4>{t('detail.characters.title')}</h4>
                      {itemCharacters.length > 0 && (
                        <span className="faint">
                          {t('detail.characters.count', { count: itemCharacters.length })}
                        </span>
                      )}
                    </div>
                    {itemCharacters.length ? (
                      <div className="character-strip">
                        {itemCharacters.map((tag) => (
                          <button
                            key={tag!.id}
                            className="character-chip"
                            onClick={() => navigate(`/gallery?tag=${tag!.id}`)}
                            title={t('detail.characters.viewAll', { name: tag!.name })}
                          >
                            <CharacterAvatar tagId={tag!.id} />
                            <span>{tag!.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="faint">
                        {IS_PUBLIC
                          ? t('detail.characters.emptyPublic')
                          : t('detail.characters.emptyLocal')}
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
                          <h4>{t('detail.dateReview.title')}</h4>
                        </div>
                        <DateEditor item={item} compact />
                      </section>

                      <section className="detail-section">
                        <div className="section-head">
                          <h4>{t('common.note')}</h4>
                          <span className="faint">{t('detail.note.autoSave')}</span>
                        </div>
                        <textarea
                          className="textarea"
                          placeholder={t('detail.note.placeholder')}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => setNote(item.id, noteDraft)}
                        />
                      </section>

                      <section className="detail-section">
                        <div className="section-head">
                          <h4>{t('detail.links.title')}</h4>
                          <span className="faint">{t('detail.links.hint')}</span>
                        </div>
                        <div className="link-field">
                          <span className="field-label">{t('detail.links.xiaohongshuLabel')}</span>
                          <div className="link-input-row">
                            <input
                              className="input"
                              value={linkDrafts.xiaohongshu}
                              placeholder={t('detail.links.xiaohongshuPlaceholder')}
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
                                {t('common.clear')}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="link-field">
                          <span className="field-label">{t('detail.links.wechatLabel')}</span>
                          <div className="link-input-row">
                            <input
                              className="input"
                              value={linkDrafts.wechat}
                              placeholder={t('detail.links.wechatPlaceholder')}
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
                                {t('common.clear')}
                              </button>
                            )}
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>{t('detail.palette.title')}</h4>
                      <span className="faint">{t('detail.palette.hint')}</span>
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
                            notify(t('detail.palette.copied', { color: hex }), 'success')
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
                        <h4>{t('detail.similar.title')}</h4>
                        <span className="faint">{t('detail.similar.hint')}</span>
                      </div>
                      <div className="similar-grid">
                        {similar.map(({ item: s, shared }) => (
                          <button key={s.id} className="similar-item" onClick={() => navigate(`/item/${s.id}`)}>
                            <img src={`${BASE}${s.thumb}`} alt="" loading="lazy" />
                            {shared > 0 && (
                              <span className="similar-badge num">
                                {t('detail.similar.sharedTags', { count: shared })}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="detail-section">
                    <div className="section-head">
                      <h4>{t('detail.original.title')}</h4>
                      <span className="faint">
                        {t('detail.original.size', { size: formatBytes(item.bytes) })}
                      </span>
                    </div>
                    <div className="original-actions">
                      <a className="btn btn-primary btn-sm" href={originalUrl(item)} download={item.file}>
                        <Icon name="download" size={14} />{t('detail.original.download')}
                      </a>
                      <a className="btn btn-sm" href={originalUrl(item)} target="_blank" rel="noreferrer">
                        <Icon name="expand" size={14} />{t('detail.original.view')}
                      </a>
                      {item.permalink && (
                        <a className="btn btn-sm btn-ghost" href={item.permalink} target="_blank" rel="noreferrer">
                          {t('detail.original.instagram')}<Icon name="right" size={12} />
                        </a>
                      )}
                    </div>
                  </section>

                  <section className="detail-section meta-list">
                    <div className="section-head">
                      <h4>{t('detail.meta.title')}</h4>
                      <span className={`badge ${date.confirmed ? 'badge-sage' : 'badge-warn'}`}>
                        {date.source === 'manual'
                          ? t('detail.meta.sourceManual')
                          : date.source === 'published'
                            ? t('detail.meta.sourcePublished')
                            : t('detail.meta.sourceInferred')}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.diaryDate')}</span>
                      <span className="num">{date.iso} · {weekdayLabel(date.iso)}</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.publishedDate')}</span>
                      <span className="num">{item.publishedAt}</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.dimensions')}</span>
                      <span className="num">{item.w} × {item.h} px</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.fileSize')}</span>
                      <span className="num">{formatBytes(item.bytes)}</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.postImages')}</span>
                      <span className="num">
                        {t('detail.meta.postImagesValue', {
                          index: item.postIndex + 1,
                          count: item.postCount,
                        })}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>Shortcode</span>
                      <span className="num">{item.shortcode}</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.sourceFile')}</span>
                      <span className="num meta-file">
                        {item.sourceFile ?? t('detail.meta.notRecorded')}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.fileName')}</span>
                      <span className="num meta-file">{item.file}</span>
                    </div>
                    <div className="meta-row">
                      <span>{t('detail.meta.inferredDate')}</span>
                      <span className="num">
                        {item.inferredYear}-{String(item.inferredMonth).padStart(2, '0')}-
                        {String(item.inferredDay).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                      {t('detail.meta.footnote')}
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
                  <div className="study-intro">{t('detail.study.intro')}</div>
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
                      {t('detail.study.save')}
                    </button>
                  </div>
                  <section className="detail-section">
                    <div className="section-head">
                      <h4>{t('detail.study.palette')}</h4>
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
                        <h4>{t('detail.study.similar')}</h4>
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
        <Modal title={t('detail.delete.title')} onClose={() => setDeleteOpen(false)}>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            {t('detail.delete.bodyBefore')}
            <code> images/_trash/</code>
            {t('detail.delete.bodyAfterTrash')}
            <code>npm run dev</code>
            {t('detail.delete.bodyAfterDev')}
            <code>npm run purge</code>
            {t('detail.delete.bodyAfterPurge')}
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-danger-ghost"
              onClick={async () => {
                const moved = await moveFilesToTrash([item.file])
                deleteItems([item.id])
                notify(
                  moved ? t('detail.delete.moved') : t('detail.delete.removed'),
                  'success',
                )
                setDeleteOpen(false)
                closeItem()
              }}
            >
              {t('detail.delete.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {collectionOpen && (
        <Modal title={t('detail.actions.addToCollection')} onClose={() => setCollectionOpen(false)}>
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
                      notify(t('detail.collections.added', { name: col.name }), 'success')
                      setCollectionOpen(false)
                    }}
                  >
                    <Icon name="folder" size={16} />
                    <span>{col.name}</span>
                    <span className="faint">
                      {t('common.itemCount', { count: col.itemIds.length })}
                    </span>
                    {inCol && <Icon name="check" size={14} />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="muted" style={{ padding: '12px 0' }}>
              {t('detail.collections.emptyBefore')}
              <a href="#/collections" style={{ color: 'var(--accent)' }}>
                {t('detail.collections.emptyLink')}
              </a>
              {t('detail.collections.emptyAfter')}
            </div>
          )}
          <div className="modal-foot" style={{ padding: '14px 0 0', background: 'none' }}>
            <a className="btn btn-sm" href="#/collections">
              {t('detail.collections.manage')}
            </a>
          </div>
        </Modal>
      )}

      {compareOpen && (
        <Modal title={t('detail.compare.title')} onClose={() => setCompareOpen(false)} wide>
          <div className="compare-pick">
            <span className="faint">{t('detail.compare.pickHint')}</span>
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
                  <span className="similar-badge">{t('common.previous')}</span>
                </button>
              )}
            </div>
          </div>
          <div className="compare-stage">
            <figure>
              <img src={`${BASE}${item.large}`} alt={t('detail.compare.currentAlt')} className={mirror ? 'mirror' : ''} />
              <figcaption>
                {t('detail.compare.current', { date: formatMonthDay(date.month, date.day) })}
              </figcaption>
            </figure>
            <figure>
              {compareItem ? (
                <img
                  src={`${BASE}${compareItem.large}`}
                  alt={t('detail.compare.otherAlt')}
                  className={mirror ? 'mirror' : ''}
                />
              ) : (
                <div className="compare-empty">{t('detail.compare.empty')}</div>
              )}
              <figcaption>
                {compareItem
                  ? `${formatMonthDay(getDate(compareItem).month, getDate(compareItem).day)} · ${getDate(compareItem).year}`
                  : t('detail.compare.other')}
              </figcaption>
            </figure>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <label className="toggle-row">
              <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
              {t('detail.compare.gray')}
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
              {t('detail.compare.mirror')}
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
  const { t } = useI18n()
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
      onNotify(t('detail.translation.cleared'), 'success')
      return
    }
    onChange({ source, slots, sourceDraft: draft || undefined, updatedAt: new Date().toISOString() })
    onNotify(t('detail.translation.saved'), 'success')
  }

  const addSlot = () => {
    const existing = new Set(slots.map((s) => s.lang))
    const nextLang = ['zh', 'en', 'ko', 'fr', 'ja'].find((l) => !existing.has(l)) ?? `lang${slots.length + 1}`
    const label = nextLang === 'zh' ? '中文' : nextLang === 'en' ? 'English' : nextLang === 'ko' ? '한국어' : nextLang === 'fr' ? 'Français' : '日本語'
    setSlots((prev) => [...prev, { lang: nextLang, label, text: '' }])
  }

  // 公开端只读展示译文；没有译文时给出占位提示，不渲染任何输入控件
  if (readOnly) {
    return (
      <div className="translation-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className={`badge ${translated ? 'badge-sage' : 'badge-accent'}`}>
            {translated ? t('detail.translation.translated') : t('detail.translation.untranslated')}
          </span>
        </div>
        {translated ? (
          <>
            {source.trim() ? (
              <div className="translation-field">
                <span className="field-label">{t('detail.translation.sourceLabel')}</span>
                <p className="translation-readonly">{source}</p>
              </div>
            ) : null}
            {slots
              .filter((slot) => slot.text.trim())
              .map((slot) => (
                <div key={slot.lang} className="translation-field">
                  <span className="field-label">{slot.label}</span>
                  <p className="translation-readonly">{slot.text}</p>
                </div>
              ))}
          </>
        ) : (
          <p className="translation-empty">{t('detail.translation.emptyPublic')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="translation-panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`badge ${translated ? 'badge-sage' : 'badge-accent'}`}>
          {translated ? t('detail.translation.translated') : t('detail.translation.untranslated')}
        </span>
        <button className="btn btn-primary btn-sm" onClick={save}>
          {t('detail.translation.save')}
        </button>
      </div>

      <label className="translation-field">
        <span className="field-label">{t('detail.translation.sourceLabel')}</span>
        <textarea
          className="textarea"
          placeholder={t('detail.translation.sourcePlaceholder')}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>

      {draft && (
        <div className="translation-draft">
          <button className="btn btn-ghost btn-sm" onClick={() => setDraftOpen((v) => !v)}>
            {draftOpen ? t('detail.translation.hideDraft') : t('detail.translation.showDraft')}
          </button>
          {draftOpen && (
            <>
              <div className="draft-text">{draft}</div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSource((prev) => (prev ? `${prev}\n${draft}` : draft))}
              >
                {t('detail.translation.fillSource')}
              </button>
            </>
          )}
        </div>
      )}

      {slots.map((slot, index) => (
        <label key={`${slot.lang}-${index}`} className="translation-field">
          <span className="row" style={{ justifyContent: 'space-between' }}>
            <span className="field-label">{slot.label}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
              type="button"
            >
              {t('detail.translation.removeLanguage')}
            </button>
          </span>
          <textarea
            className="textarea"
            placeholder={t('detail.translation.slotPlaceholder', { label: slot.label })}
            value={slot.text}
            onChange={(e) =>
              setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, text: e.target.value } : s)))
            }
          />
        </label>
      ))}

      <button className="btn btn-sm" onClick={addSlot}>
        <Icon name="plus" size={13} />{t('detail.translation.addLanguage')}
      </button>
    </div>
  )
}
