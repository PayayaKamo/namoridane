import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { effectiveDate, formatMonthDayCN } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Masonry } from '../components/ItemCard'
import { Empty, Modal } from '../components/Modal'
import { TagPicker } from '../components/TagPicker'
import { IS_PUBLIC } from '../lib/appMode'
import type { DiaryItem } from '../types'

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
    const url = `${location.origin}${location.pathname}#/datefind?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      notify('日期查询链接已复制', 'success')
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

  const applySelectionTags = () => {
    if (!selectedIds.length) return
    for (const tagId of pickTags) addTagToItems(selectedIds, tagId)
    notify(`已为 ${selectedIds.length} 张作品打上 ${pickTags.length} 个标签`, 'success')
    setPickTags([])
    setTagModal(false)
    resetSelection()
  }

  if (!valid) {
    return (
      <div className="datefind-view">
        <Empty
          icon="calendar"
          title="没有识别出有效日期"
          hint="在顶部搜索框输入 20261117、2026-11-17、11-17 或 11/17 即可按日期查画。"
          action={
            <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/calendar')}>
              去日历挑一天
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
          <div className="page-eyebrow">Date Lookup</div>
          <h2 className="page-title">{formatMonthDayCN(month, day)}的绘日记</h2>
          <div className="page-sub">
            {visible.length} 张 · 默认只统计人工确认的日期
            {includeInferred ? ' · 已包含推测日期' : ''}
            {String(focusYear) !== '0' && ` · 聚焦 ${focusYear} 年`}
          </div>
        </div>
        <div className="page-actions">
          <label className="switch-line">
            <input type="checkbox" checked={includeInferred} onChange={toggleInferred} />
            包含推测日期（发布日 - 1）
          </label>
          <button className="btn" onClick={copyShare}>
            <Icon name="share" size={14} />分享查询
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
              清除筛选
            </button>
          )}
        </section>
      )}

      {groups.length === 0 ? (
        <Empty
          icon="calendar"
          title={formatMonthDayCN(month, day) + ' 暂无已确认的绘日记'}
          hint={
            IS_PUBLIC
              ? '这个日期暂无已确认的绘日记，可以换一天或调整筛选条件。'
              : includeInferred
                ? '可以到「绘日记审核」确认日期，或检查标签筛选条件。'
                : '可打开「包含推测日期」查看发布日 - 1 的推测结果。'
          }
          action={
            !includeInferred ? (
              <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={toggleInferred}>
                包含推测日期
              </button>
            ) : IS_PUBLIC ? null : (
              <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/diary-review')}>
                去审核日期
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
              {selectMode ? '退出多选' : '多选'}
            </button>
            {selectMode && (
              <>
                <span className="faint">已选 {selectedIds.length} 张</span>
                <button className="btn btn-sm" disabled={!selectedIds.length} onClick={() => setStorylineModal(true)}>
                  <Icon name="book" size={14} />加入故事线
                </button>
                <button className="btn btn-sm" disabled={!selectedIds.length} onClick={() => setTagModal(true)}>
                  <Icon name="tag" size={14} />批量打标签
                </button>
              </>
            )}
          </div>

          {groups.map(([year, list]) => (
            <section key={year} className={`datefind-group${focusYear === year ? ' focus' : ''}`}>
              <button className="datefind-group-head" onClick={() => toggleYear(year)}>
                <span className="hand">{year} 年</span>
                <span className="badge">{list.length} 张</span>
                <span className="spacer" />
                <Icon name={openYears(year) ? 'up' : 'down'} size={14} />
              </button>
              {openYears(year) && (
                <Masonry
                  items={list}
                  selectable={selectMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                />
              )}
            </section>
          ))}
        </>
      )}

      {storylineModal && (
        <Modal title={`把 ${selectedIds.length} 张加入故事线`} onClose={() => setStorylineModal(false)}>
          <div className="field">
            <span className="field-label">选择已有故事线</span>
            <div className="storyline-pick-list">
              {storylines.map((story) => (
                <button
                  key={story.id}
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    addToStoryline(story.id, selectedIds)
                    notify(`已加入「${story.title}」`, 'success')
                    setStorylineModal(false)
                    resetSelection()
                  }}
                >
                  {story.title}
                </button>
              ))}
              {!storylines.length && <span className="faint">还没有故事线，可以直接新建。</span>}
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <span className="field-label">或新建故事线</span>
            <div className="row">
              <input
                className="input"
                placeholder="故事线标题"
                value={newStoryline}
                onChange={(e) => setNewStoryline(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const story = addStoryline(newStoryline.trim() || '未命名故事线', selectedIds)
                  notify(`已创建「${story.title}」并加入 ${selectedIds.length} 张`, 'success')
                  setNewStoryline('')
                  setStorylineModal(false)
                  resetSelection()
                }}
              >
                创建
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tagModal && (
        <Modal
          title={`为 ${selectedIds.length} 张批量打标签`}
          onClose={() => setTagModal(false)}
          footer={
            <button className="btn btn-primary" disabled={!pickTags.length} onClick={applySelectionTags}>
              应用标签
            </button>
          }
        >
          <TagPicker selected={pickTags} onChange={setPickTags} />
        </Modal>
      )}
    </div>
  )
}
