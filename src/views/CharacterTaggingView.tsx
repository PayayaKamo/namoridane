import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { CharacterPicker } from '../components/CharacterPicker'
import { Icon } from '../components/Icon'

const BASE = import.meta.env.BASE_URL
type Scope = 'todo' | 'all'

/**
 * 人物标注：只针对已确认的绘日记，逐张快速标记出场角色。
 * 列表在筛选变化时生成快照，标完当前一张不会立刻从队列里消失，
 * 方便连续点选多个角色；「下一张」会跳过已标注的条目。
 */
export function CharacterTaggingView() {
  const { confirmedDiaryItems, annotations, tags, itemMap, tagUsage, setItemTags, getDate, notify } = useStore()
  const [scope, setScope] = useState<Scope>('todo')
  const [charFilter, setCharFilter] = useState('')
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)

  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const characterTags = useMemo(() => tags.filter((tag) => tag.dimensionId === 'character'), [tags])

  const charsOf = (id: string) => (annotations[id]?.tags ?? []).filter((tagId) => tagMap.get(tagId)?.dimensionId === 'character')
  const othersOf = (id: string) => (annotations[id]?.tags ?? []).filter((tagId) => tagMap.get(tagId)?.dimensionId !== 'character')

  const labeledIds = useMemo(() => {
    const set = new Set<string>()
    for (const item of confirmedDiaryItems) {
      if ((annotations[item.id]?.tags ?? []).some((tagId) => tagMap.get(tagId)?.dimensionId === 'character')) {
        set.add(item.id)
      }
    }
    return set
  }, [confirmedDiaryItems, annotations, tagMap])

  // 每个角色在本页范围内的出场次数，用于筛选下拉
  const charCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of confirmedDiaryItems) {
      for (const tagId of annotations[item.id]?.tags ?? []) {
        if (tagMap.get(tagId)?.dimensionId !== 'character') continue
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
    return counts
  }, [confirmedDiaryItems, annotations, tagMap])

  // 筛选变化或索引就绪时重建队列；标注写入不重建，当前这张保持不变
  useEffect(() => {
    const next = confirmedDiaryItems
      .filter((item) => {
        if (charFilter) {
          return (annotations[item.id]?.tags ?? []).includes(charFilter)
        }
        return scope === 'all' || !labeledIds.has(item.id)
      })
      .map((item) => item.id)
    setQueue(next)
    setIndex(0)
    // 仅在筛选、数据载入或范围变化时重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, charFilter, confirmedDiaryItems.length])

  const safeIndex = Math.min(index, Math.max(0, queue.length - 1))
  const currentId = queue[safeIndex]
  const current = currentId ? itemMap.get(currentId) : undefined
  const selected = current ? charsOf(current.id) : []

  const quickTags = useMemo(() => {
    const chosen = characterTags.filter((tag) => selected.includes(tag.id))
    const rest = characterTags
      .filter((tag) => !selected.includes(tag.id))
      .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    return [...chosen, ...rest]
  }, [characterTags, selected, tagUsage])

  const applyChars = (itemId: string, ids: string[]) => setItemTags(itemId, [...othersOf(itemId), ...ids])

  const goPrev = () => {
    if (safeIndex <= 0) {
      notify('已经是第一张了')
      return
    }
    setIndex(safeIndex - 1)
  }

  const goNext = () => {
    if (!queue.length) return
    for (let i = safeIndex + 1; i < queue.length; i += 1) {
      // 按角色筛选时整队都已标注，不必跳过
      if (!charFilter && labeledIds.has(queue[i])) continue
      setIndex(i)
      return
    }
    notify('已经是最后一张了')
  }

  const toggleAt = (slot: number) => {
    const tag = quickTags[slot]
    if (!current || !tag) return
    const ids = selected.includes(tag.id) ? selected.filter((id) => id !== tag.id) : [...selected, tag.id]
    applyChars(current.id, ids)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        goNext()
      } else if (/^[1-9]$/.test(event.key)) {
        event.preventDefault()
        toggleAt(Number(event.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = confirmedDiaryItems.length
  const labeled = labeledIds.size
  const todoCount = total - labeled
  const date = current ? getDate(current) : null

  return (
    <div className="tagging-view">
      <div className="tagging-bar">
        <div className="tagging-progress">
          <strong>
            {labeled} / {total}
          </strong>
          <span>已标注</span>
          <span className="tagging-todo">还差 {todoCount} 张</span>
        </div>
        <div className="tagging-filters">
          <div className="segmented">
            <button
              className={!charFilter && scope === 'todo' ? 'active' : ''}
              onClick={() => {
                setCharFilter('')
                setScope('todo')
              }}
            >
              未标注
            </button>
            <button
              className={!charFilter && scope === 'all' ? 'active' : ''}
              onClick={() => {
                setCharFilter('')
                setScope('all')
              }}
            >
              全部
            </button>
          </div>
          <select className="select" value={charFilter} onChange={(event) => setCharFilter(event.target.value)}>
            <option value="">按角色筛选…</option>
            {characterTags
              .slice()
              .sort((a, b) => (charCounts.get(b.id) ?? 0) - (charCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}（{charCounts.get(tag.id) ?? 0}）
                </option>
              ))}
          </select>
        </div>
        <div className="tagging-nav">
          <button className="btn btn-sm" onClick={goPrev} disabled={safeIndex <= 0} title="上一张（←）">
            <Icon name="left" size={14} />
            上一张
          </button>
          <button className="btn btn-sm btn-primary" onClick={goNext} title="下一张（Enter / →）">
            下一张
            <Icon name="right" size={14} />
          </button>
        </div>
      </div>

      {!queue.length ? (
        <div className="panel tagging-empty">
          {charFilter
            ? '这个角色下还没有标注过的绘日记。'
            : scope === 'todo'
              ? '全部绘日记都标完了。'
              : '还没有已确认的绘日记，请先到「绘日记审核」确认。'}
        </div>
      ) : (
        current && (
          <div className="panel tagging-card">
            <div className="tagging-figure">
              <img src={`${BASE}${current.large || current.thumb}`} alt="" />
            </div>
            <div className="tagging-meta">
              <span>
                {date?.year} 年 {date?.month} 月 {date?.day} 日
              </span>
              {current.shortcode && <span className="tagging-code">#{current.shortcode}</span>}
              <span className="tagging-pos">
                {safeIndex + 1} / {queue.length}
              </span>
            </div>
            <div className="tagging-picker">
              <CharacterPicker selected={selected} onChange={(ids) => applyChars(current.id, ids)} />
            </div>
            <p className="tagging-hint">
              点选芯片标记或取消 · <kbd>Enter</kbd> / <kbd>→</kbd> 下一张 · <kbd>←</kbd> 上一张 · <kbd>1</kbd>–<kbd>9</kbd> 快速点选
            </p>
          </div>
        )
      )}
    </div>
  )
}
