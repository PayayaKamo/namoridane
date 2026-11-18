import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { CharacterPicker } from '../components/CharacterPicker'
import { Icon } from '../components/Icon'
import { sortCharacterTags } from '../lib/constants'

const BASE = import.meta.env.BASE_URL
type Scope = 'todo' | 'labeled' | 'all'

/**
 * 人物标注：只针对已确认的绘日记，逐张快速标记出场角色。
 * 列表在筛选变化时生成快照，标完当前一张不会立刻从队列里消失，
 * 方便连续点选多个角色；「下一张」会跳过已标注的条目。
 */
export function CharacterTaggingView() {
  const { confirmedDiaryItems, annotations, tags, itemMap, setItemTags, getDate } = useStore()
  const { t } = useI18n()
  const [scope, setScope] = useState<Scope>('todo')
  const [charFilter, setCharFilter] = useState('')
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // 视图高度按可视区计算，保证一屏放下、不产生页面级滚动
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current
      if (!el) return
      const parent = el.parentElement
      const bottomPad = parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0
      const top = el.getBoundingClientRect().top + window.scrollY
      setViewportHeight(Math.max(0, Math.floor(window.innerHeight - top - bottomPad)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const characterTags = useMemo(
    () => sortCharacterTags(tags.filter((tag) => tag.dimensionId === 'character')),
    [tags],
  )

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
        if (scope === 'todo') return !labeledIds.has(item.id)
        if (scope === 'labeled') return labeledIds.has(item.id)
        return true
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

  // 芯片与角色图鉴同一顺序；已选角色只做高亮，不再置前，保证数字快捷键与视觉顺序一致
  const quickTags = characterTags

  const applyChars = (itemId: string, ids: string[]) => setItemTags(itemId, [...othersOf(itemId), ...ids])

  const goPrev = () => {
    if (!queue.length) return
    // 首尾循环：第一张再往前跳到队列最后一张，与绘日记审核页一致
    setIndex(safeIndex <= 0 ? queue.length - 1 : safeIndex - 1)
  }

  const goNext = () => {
    if (!queue.length) return
    const skipped = (i: number) => scope === 'todo' && !charFilter && labeledIds.has(queue[i])
    for (let i = safeIndex + 1; i < queue.length; i += 1) {
      // 只在「未标注」里跳过已标注；「全部」按顺序逐张翻看，方便回改
      if (skipped(i)) continue
      setIndex(i)
      return
    }
    // 最后一张之后回到开头继续找，实现首尾循环
    for (let i = 0; i <= safeIndex; i += 1) {
      if (skipped(i)) continue
      setIndex(i)
      return
    }
    setIndex(0)
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
    <div className="tagging-view" ref={rootRef} style={viewportHeight ? { height: viewportHeight } : undefined}>
      <div className="tagging-bar">
        <div className="tagging-progress">
          <strong>
            {t('characters.tagging.progress', { done: labeled, total })}
          </strong>
          <span>{t('characters.tagging.labeled')}</span>
          {!charFilter && scope === 'todo' ? (
            <span className="tagging-todo">{t('characters.tagging.remaining', { count: todoCount })}</span>
          ) : (
            <span className="tagging-todo">{t('characters.tagging.current', { count: queue.length })}</span>
          )}
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
              {t('characters.tagging.scopeTodo')}
            </button>
            <button
              className={!charFilter && scope === 'labeled' ? 'active' : ''}
              onClick={() => {
                setCharFilter('')
                setScope('labeled')
              }}
            >
              {t('characters.tagging.scopeLabeled')}
            </button>
            <button
              className={!charFilter && scope === 'all' ? 'active' : ''}
              onClick={() => {
                setCharFilter('')
                setScope('all')
              }}
            >
              {t('common.all')}
            </button>
          </div>
          <select className="select" value={charFilter} onChange={(event) => setCharFilter(event.target.value)}>
            <option value="">{t('characters.tagging.filterPlaceholder')}</option>
            {characterTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {t('characters.tagging.option', { name: tag.name, count: charCounts.get(tag.id) ?? 0 })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!queue.length ? (
        <div className="panel tagging-empty">
          {charFilter
            ? t('characters.tagging.emptyForCharacter')
            : scope === 'todo'
              ? t('characters.tagging.emptyDone')
              : scope === 'labeled'
                ? t('characters.tagging.emptyLabeled')
                : t('characters.tagging.emptyNoConfirmed')}
        </div>
      ) : (
        current && (
          <div className="panel tagging-card">
            <div className="tagging-figure">
              <img src={`${BASE}${current.large || current.thumb}`} alt="" />
            </div>
            <div className="tagging-meta">
              {date && <span>{t('common.fullDate', { year: date.year, month: date.month, day: date.day })}</span>}
              {current.shortcode && <span className="tagging-code">#{current.shortcode}</span>}
              <span className="tagging-pos">
                {safeIndex + 1} / {queue.length}
              </span>
            </div>
            <div className="tagging-picker">
              <CharacterPicker selected={selected} onChange={(ids) => applyChars(current.id, ids)} />
            </div>
            <div className="tagging-foot">
              <button className="btn btn-sm" onClick={goPrev} title={t('characters.tagging.prevTitle')}>
                <Icon name="left" size={14} />
                {t('common.previous')}
              </button>
              <p className="tagging-hint">
                {t('characters.tagging.hintClick')} · <kbd>Enter</kbd> / <kbd>→</kbd> {t('characters.tagging.hintNext')} · <kbd>←</kbd> {t('characters.tagging.hintPrev')} · <kbd>1</kbd>–<kbd>9</kbd> {t('characters.tagging.hintQuick')}
              </p>
              <button className="btn btn-primary tagging-confirm" onClick={goNext} title={t('characters.tagging.confirmTitle')}>
                {t('common.confirm')}
                <Icon name="right" size={14} />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
