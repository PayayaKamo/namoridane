import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate, siteHref } from '../lib/router'
import { useStore } from '../state/store'
import { effectiveDate, formatMonthDayCN, isoOf, weekdayLabel } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { TagPicker } from '../components/TagPicker'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL

export function DateFindView({ route }: { route: Route }) {
  const {
    allItems,
    annotations,
    tags,
    dimensions,
    storylines,
    addStoryline,
    addToStoryline,
    addTagToItems,
    notify,
  } = useStore()
  const { t } = useI18n()

  const md = route.query.get('md') ?? ''
  const [monthPart, dayPart] = md.split('-')
  const month = Number(monthPart)
  const day = Number(dayPart)
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31
  const focusYear = Number(route.query.get('y')) || 0
  const [includeInferred, setIncludeInferred] = useState(route.query.get('infer') === '1')
  const [tagIds, setTagIds] = useState<string[]>(
    () => route.query.get('tags')?.split(',').filter(Boolean) ?? [],
  )
  const [manualOpen, setManualOpen] = useState<Record<number, boolean>>({})
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openCaptions, setOpenCaptions] = useState<Set<string>>(new Set())
  const [storylineModal, setStorylineModal] = useState(false)
  const [newStoryline, setNewStoryline] = useState('')
  const [tagModal, setTagModal] = useState(false)
  const [pickTags, setPickTags] = useState<string[]>([])

  const dateOf = (item: DiaryItem) => {
    const ann = annotations[item.id]
    if (ann?.date?.confirmed) {
      return { year: ann.date.year, month: ann.date.month, day: ann.date.day, confirmed: true }
    }
    if (!includeInferred) return null
    const eff = effectiveDate(item, ann)
    if (!eff.iso) return null
    return { year: eff.year, month: eff.month, day: eff.day, confirmed: false }
  }

  const matched = useMemo(() => {
    if (!valid) return []
    return allItems.filter((item) => {
      const ann = annotations[item.id]
      if (ann?.excluded) return false
      const d = dateOf(item)
      return Boolean(d && d.month === month && d.day === day)
    })
    // dateOf 依赖 includeInferred / annotations
  }, [allItems, annotations, includeInferred, month, day, valid])

  const selectedByDim = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const tagId of tagIds) {
      const tag = tags.find((t) => t.id === tagId)
      const dim = tag?.dimensionId ?? 'custom'
      map.set(dim, [...(map.get(dim) ?? []), tagId])
    }
    return map
  }, [tagIds, tags])

  const visible = useMemo(() => {
    if (!selectedByDim.size) return matched
    return matched.filter((item) => {
      const itemTags = new Set(annotations[item.id]?.tags ?? [])
      for (const ids of selectedByDim.values()) {
        if (!ids.some((id) => itemTags.has(id))) return false
      }
      return true
    })
  }, [matched, selectedByDim, annotations])

  const groups = useMemo(() => {
    const map = new Map<number, DiaryItem[]>()
    for (const item of visible) {
      const d = dateOf(item)
      if (!d) continue
      if (!map.has(d.year)) map.set(d.year, [])
      map.get(d.year)!.push(item)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.publishedAt || '9999').localeCompare(b.publishedAt || '9999') || a.postIndex - b.postIndex)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, annotations, includeInferred])

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of matched) {
      for (const id of annotations[item.id]?.tags ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return dimensions
      .map((dim) => ({
        dim,
        tags: tags
          .filter((t) => t.dimensionId === dim.id && counts.has(t.id))
          .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.tags.length > 0)
  }, [matched, annotations, dimensions, tags])

  const syncUrl = (next: { infer?: boolean; tags?: string[] }) => {
    const params = new URLSearchParams()
    params.set('md', md)
    if (focusYear) params.set('y', String(focusYear))
    if (next.infer ?? includeInferred) params.set('infer', '1')
    const activeTags = next.tags ?? tagIds
    if (activeTags.length) params.set('tags', activeTags.join(','))
    navigate(`/datefind?${params.toString()}`, true)
  }

  const toggleTag = (id: string) => {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id]
    setTagIds(next)
    syncUrl({ tags: next })
  }

  const toggleInferred = () => {
    const next = !includeInferred
    setIncludeInferred(next)
    syncUrl({ infer: next })
  }

  const copyShare = async () => {
    const params = new URLSearchParams()
    params.set('md', md)
    if (focusYear) params.set('y', String(focusYear))
    if (includeInferred) params.set('infer', '1')
    if (tagIds.length) params.set('tags', tagIds.join(','))
    const url = `${location.origin}${siteHref(`/datefind?${params.toString()}`)}`
    try {
      await navigator.clipboard.writeText(url)
      notify(t('browse.datefind.shareCopied'), 'success')
    } catch {
      notify(url, 'default')
    }
  }

  const openYears = (year: number) => manualOpen[year] ?? (focusYear ? year === focusYear : true)

  const toggleYear = (year: number) => {
    setManualOpen((prev) => ({ ...prev, [year]: !openYears(year) }))
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedIds = [...selected]
  const resetSelection = () => {
    setSelected(new Set())
    setSelectMode(false)
  }

  const toggleCaption = (id: string) => {
    setOpenCaptions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyShortcode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      notify(t('browse.datefind.shortcodeCopied', { code }), 'success')
    } catch {
      notify(code, 'default')
    }
  }

  const openItem = (item: DiaryItem) => {
    if (selectMode) {
      toggleSelect(item.id)
      return
    }
    navigate(`/item/${item.id}`)
  }

  const applySelectionTags = () => {
    if (!selectedIds.length) return
    for (const tagId of pickTags) addTagToItems(selectedIds, tagId)
    notify(t('browse.datefind.tagsApplied', { count: selectedIds.length, tags: pickTags.length }), 'success')
    setPickTags([])
    setTagModal(false)
    resetSelection()
  }

  if (!valid) {
    return (
      <div className="datefind-view">
        <Empty
          icon="calendar"
          title={t('browse.datefind.invalidTitle')}
          hint={t('browse.datefind.invalidHint')}
          action={
            <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/calendar')}>
              {t('browse.datefind.goCalendar')}
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="datefind-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.datefind.eyebrow')}</div>
          <h2 className="page-title">{t('browse.datefind.title', { date: formatMonthDayCN(month, day) })}</h2>
          <div className="page-sub">
            {t('browse.datefind.summary', { count: visible.length })}
            {includeInferred ? t('browse.datefind.includedInferred') : ''}
            {String(focusYear) !== '0' && t('browse.datefind.focusYear', { year: focusYear })}
          </div>
        </div>
        <div className="page-actions">
          <label className="switch-line">
            <input type="checkbox" checked={includeInferred} onChange={toggleInferred} />
            {t('browse.datefind.includeInferred')}
          </label>
          <button className="btn" onClick={copyShare}>
            <Icon name="share" size={14} />
            {t('browse.datefind.share')}
          </button>
        </div>
      </div>

      {availableTags.length > 0 && (
        <section className="datefind-filters">
          {availableTags.map(({ dim, tags: dimTags }) => (
            <div key={dim.id} className="datefind-filter-row">
              <span className="field-label">{dim.name}</span>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {dimTags.map((tag) => (
                  <button
                    key={tag.id}
                    className={`chip${tagIds.includes(tag.id) ? ' active' : ''}`}
                    style={
                      tagIds.includes(tag.id)
                        ? { background: tag.color, borderColor: tag.color, color: '#fff' }
                        : { borderColor: `color-mix(in srgb, ${tag.color} 32%, var(--line))` }
                    }
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span className="color-dot" style={{ background: tag.color, width: 7, height: 7 }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {tagIds.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setTagIds([]); syncUrl({ tags: [] }) }}>
              {t('browse.datefind.clearFilters')}
            </button>
          )}
        </section>
      )}

      {groups.length === 0 ? (
        <Empty
          icon="calendar"
          title={t('browse.datefind.emptyTitle', { date: formatMonthDayCN(month, day) })}
          hint={
            IS_PUBLIC
              ? t('browse.datefind.emptyPublicHint')
              : includeInferred
                ? t('browse.datefind.emptyInferredHint')
                : t('browse.datefind.emptyHint')
          }
          action={
            !includeInferred ? (
              <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={toggleInferred}>
                {t('browse.datefind.includeInferredAction')}
              </button>
            ) : IS_PUBLIC ? null : (
              <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/diary-review')}>
                {t('browse.datefind.goReview')}
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="datefind-toolbar">
            <button
              className={`btn btn-sm${selectMode ? ' btn-primary' : ''}`}
              onClick={() => {
                setSelectMode((v) => !v)
                setSelected(new Set())
              }}
            >
              <Icon name="checkSquare" size={14} />
              {selectMode ? t('browse.datefind.exitSelect') : t('browse.datefind.enterSelect')}
            </button>
            {selectMode && (
              <>
                <span className="faint">{t('common.selectedCount', { count: selectedIds.length })}</span>
                <button className="btn btn-sm" disabled={!selectedIds.length} onClick={() => setStorylineModal(true)}>
                  <Icon name="book" size={14} />
                  {t('browse.datefind.addToStoryline')}
                </button>
                <button className="btn btn-sm" disabled={!selectedIds.length} onClick={() => setTagModal(true)}>
                  <Icon name="tag" size={14} />
                  {t('browse.datefind.batchTag')}
                </button>
              </>
            )}
          </div>

          {groups.map(([year, list]) => (
            <section key={year} className={`datefind-group${focusYear === year ? ' focus' : ''}`}>
              <button className="datefind-group-head" onClick={() => toggleYear(year)}>
                <span className="hand">{t('common.yearLabel', { year })}</span>
                <span className="badge">{t('common.itemCount', { count: list.length })}</span>
                <span className="spacer" />
                <Icon name={openYears(year) ? 'up' : 'down'} size={14} />
              </button>
              {openYears(year) && (
                <div className="datefind-cards">
                  {list.map((item) => {
                    const d = dateOf(item)
                    if (!d) return null
                    const ann = annotations[item.id]
                    const weekday = weekdayLabel(isoOf(d.year, d.month, d.day))
                    const captionOpen = openCaptions.has(item.id)
                    const isSelected = selected.has(item.id)
                    return (
                      <article
                        key={item.id}
                        className={`date-card${selectMode ? ' selectable' : ''}${isSelected ? ' selected' : ''}`}
                        onClick={() => openItem(item)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openItem(item)
                          }
                        }}
                      >
                        <div className="date-card-media">
                          <img src={`${BASE}${item.thumb}`} alt={item.caption?.slice(0, 40) || item.shortcode} loading="lazy" />
                          {selectMode && (
                            <span className={`date-card-check${isSelected ? ' on' : ''}`}>
                              {isSelected && <Icon name="check" size={13} />}
                            </span>
                          )}
                        </div>
                        <div className="date-card-body">
                          <div className="date-card-head">
                            <span className="date-card-date">
                              {t('common.monthDay', { month: d.month, day: d.day })} · {weekday}
                            </span>
                            <span className="date-card-year num">{d.year}</span>
                            {!d.confirmed && <span className="badge">{t('browse.datefind.inferred')}</span>}
                          </div>
                          <div className="date-card-meta">
                            <span>
                              {t('browse.datefind.publishedAt', {
                                date: item.publishedAt || t('common.dateUnknown'),
                              })}
                            </span>
                            {item.postCount > 1 && (
                              <span className="faint">
                                {t('browse.datefind.postIndex', { index: item.postIndex + 1, total: item.postCount })}
                              </span>
                            )}
                          </div>
                          <div className="date-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="date-card-code"
                              onClick={() => copyShortcode(item.shortcode)}
                              title={t('browse.datefind.copyShortcode')}
                            >
                              <code>{item.shortcode}</code>
                              <Icon name="copy" size={12} />
                            </button>
                            {item.permalink && (
                              <a className="date-card-link" href={item.permalink} target="_blank" rel="noreferrer">
                                <Icon name="share" size={12} />
                                {t('browse.datefind.originalPost')}
                              </a>
                            )}
                            {ann?.xiaohongshu && (
                              <a className="date-card-link" href={ann.xiaohongshu} target="_blank" rel="noreferrer">
                                {t('browse.datefind.xiaohongshu')}
                              </a>
                            )}
                            {ann?.wechat && (
                              <a className="date-card-link" href={ann.wechat} target="_blank" rel="noreferrer">
                                {t('browse.datefind.wechat')}
                              </a>
                            )}
                          </div>
                          {item.caption && (
                            <div className={`date-card-caption${captionOpen ? ' open' : ''}`}>
                              <p>{item.caption}</p>
                              <button
                                className="date-card-caption-toggle"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleCaption(item.id)
                                }}
                              >
                                {captionOpen
                                  ? t('browse.datefind.collapseCaption')
                                  : t('browse.datefind.expandCaption')}
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {storylineModal && (
        <Modal
          title={t('browse.datefind.storylineModalTitle', { count: selectedIds.length })}
          onClose={() => setStorylineModal(false)}
        >
          <div className="field">
            <span className="field-label">{t('browse.datefind.pickStoryline')}</span>
            <div className="storyline-pick-list">
              {storylines.map((story) => (
                <button
                  key={story.id}
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    addToStoryline(story.id, selectedIds)
                    notify(t('browse.datefind.addedToStoryline', { name: story.title }), 'success')
                    setStorylineModal(false)
                    resetSelection()
                  }}
                >
                  {story.title}
                </button>
              ))}
              {!storylines.length && <span className="faint">{t('browse.datefind.noStorylines')}</span>}
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <span className="field-label">{t('browse.datefind.orNewStoryline')}</span>
            <div className="row">
              <input
                className="input"
                placeholder={t('browse.datefind.storylinePlaceholder')}
                value={newStoryline}
                onChange={(e) => setNewStoryline(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const story = addStoryline(newStoryline.trim() || t('lib.newStoryline'), selectedIds)
                  notify(
                    t('browse.datefind.createdStoryline', { name: story.title, count: selectedIds.length }),
                    'success',
                  )
                  setNewStoryline('')
                  setStorylineModal(false)
                  resetSelection()
                }}
              >
                {t('browse.datefind.create')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tagModal && (
        <Modal
          title={t('browse.datefind.tagModalTitle', { count: selectedIds.length })}
          onClose={() => setTagModal(false)}
          footer={
            <button className="btn btn-primary" disabled={!pickTags.length} onClick={applySelectionTags}>
              {t('browse.datefind.applyTags')}
            </button>
          }
        >
          <TagPicker selected={pickTags} onChange={setPickTags} />
        </Modal>
      )}
    </div>
  )
}
