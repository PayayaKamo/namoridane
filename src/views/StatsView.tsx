import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { CharacterAvatar } from '../components/CharacterAvatar'
import { formatFullDate, formatShortDate, monthNames, weekdayNames, effectiveDate } from '../lib/dates'
import { IS_PUBLIC } from '../lib/appMode'
import { navigate } from '../lib/router'
import type { DiaryItem } from '../types'
import { useI18n } from '../i18n'

const BASE = import.meta.env.BASE_URL
const CAST_RADIUS = 62
const CAST_CIRC = 2 * Math.PI * CAST_RADIUS
const COOC_LIMIT = 10
const TEXT_BUCKET_KEYS = [
  'stats.text.bucket.none',
  'stats.text.bucket.short',
  'stats.text.bucket.medium',
  'stats.text.bucket.long',
  'stats.text.bucket.veryLong',
] as const

export function StatsView() {
  const {
    items,
    confirmedDiaryItems,
    annotations,
    tags,
    tagMap,
    dimensions,
    tagUsage,
    collections,
    data,
    getDate,
  } = useStore()
  const { t } = useI18n()
  const [openDims, setOpenDims] = useState<Record<string, boolean>>({})
  const [hoveredCast, setHoveredCast] = useState<'single' | 'double' | 'multi' | null>(null)
  const [evoDim, setEvoDim] = useState('')
  const [castTab, setCastTab] = useState<'single' | 'double' | 'multi'>(() => {
    const saved = localStorage.getItem('namori.stats.castTab')
    return saved === 'double' || saved === 'multi' ? saved : 'single'
  })
  const changeCastTab = (tab: 'single' | 'double' | 'multi') => {
    setCastTab(tab)
    localStorage.setItem('namori.stats.castTab', tab)
  }
  const [year, setYear] = useState(() => {
    // 无年份归属的条目（year 为 0）不参与年度分组
    const years = [...new Set(items.map((i) => getDate(i).year).filter((y) => y > 0))].sort()
    return years[years.length - 1] ?? new Date().getFullYear()
  })

  const summary = useMemo(() => {
    const dates = new Set<string>()
    let confirmed = 0
    let favorites = 0
    let withNotes = 0
    let tagged = 0
    let minDate = ''
    let maxDate = ''
    for (const item of items) {
      const d = effectiveDate(item, annotations[item.id])
      dates.add(d.iso)
      // 没有日期的条目不参与覆盖跨度，避免把起始日期清空
      if (d.iso) {
        if (!minDate || d.iso < minDate) minDate = d.iso
        if (!maxDate || d.iso > maxDate) maxDate = d.iso
      }
      if (d.confirmed) confirmed++
      if (annotations[item.id]?.favorite) favorites++
      if (annotations[item.id]?.note || annotations[item.id]?.study) withNotes++
      if (annotations[item.id]?.tags.length) tagged++
    }
    const sorted = [...dates].sort()
    let longest = 0
    let current = 0
    let prev: number | null = null
    for (const iso of sorted) {
      const t = new Date(`${iso}T00:00:00`).getTime()
      if (prev !== null && t - prev === 86400000) current++
      else current = 1
      longest = Math.max(longest, current)
      prev = t
    }
    const posts = new Set(items.map((i) => i.shortcode))
    return {
      confirmed,
      favorites,
      withNotes,
      tagged,
      days: dates.size,
      minDate,
      maxDate,
      longest,
      posts: posts.size,
      multi: items.filter((i) => i.postCount > 1).length,
    }
  }, [items, annotations])

  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of items) {
      const y = getDate(item).year
      if (!y) continue // 没有年份归属的条目不生成年份分组
      counts.set(y, (counts.get(y) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0])
  }, [items, getDate])

  const maxYear = Math.max(1, ...yearCounts.map(([, c]) => c))

  const monthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    for (const item of items) {
      const d = getDate(item)
      if (d.year === year && counts[d.month - 1] !== undefined) counts[d.month - 1]++
    }
    return counts
  }, [items, getDate, year])
  const maxMonth = Math.max(1, ...monthCounts)

  const monthDays = useMemo(() => {
    const sets = Array.from({ length: 12 }, () => new Set<string>())
    for (const item of items) {
      const d = getDate(item)
      const bucket = d.year === year ? sets[d.month - 1] : undefined
      if (bucket) bucket.add(d.iso)
    }
    return sets.map((s) => s.size)
  }, [items, getDate, year])

  const tagGroups = useMemo(
    () =>
      dimensions
        // 人物维度的出场次数已在“角色出场榜”呈现，这里不再重复
        .filter((dim) => dim.id !== 'character')
        .map((dim) => ({
          dim,
          tags: tags
            .filter((t) => t.dimensionId === dim.id && (tagUsage[t.id] ?? 0) > 0)
            .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0)),
        }))
        .filter((g) => g.tags.length > 0),
    [dimensions, tags, tagUsage],
  )

  // 人物组合：管理端取已确认绘日记，公开端取公开数据集（不含审核状态）
  const castItems = IS_PUBLIC ? items : confirmedDiaryItems
  const cast = useMemo(() => {
    const charTagIds = new Set(tags.filter((tag) => tag.dimensionId === 'character').map((tag) => tag.id))
    const pairCounts = new Map<string, number>()
    const groupCounts = new Map<string, number>()
    const singleCounts = new Map<string, number>()
    let single = 0
    let double = 0
    let multi = 0
    for (const item of castItems) {
      const ids = [...new Set((annotations[item.id]?.tags ?? []).filter((id) => charTagIds.has(id)))].sort()
      if (!ids.length) continue
      if (ids.length === 1) {
        single++
        singleCounts.set(ids[0], (singleCounts.get(ids[0]) ?? 0) + 1)
        continue
      }
      if (ids.length === 2) {
        double++
      } else {
        multi++
        const groupKey = ids.join('|')
        groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1)
      }
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const key = `${ids[i]}|${ids[j]}`
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
        }
      }
    }
    const toRanking = (counts: Map<string, number>) =>
      [...counts.entries()]
        .map(([key, count]) => ({ ids: key.split('|'), count }))
        .sort((a, b) => b.count - a.count || a.ids.join().localeCompare(b.ids.join()))
    return {
      single,
      double,
      multi,
      total: single + double + multi,
      pairImages: double + multi,
      pairs: toRanking(pairCounts),
      singles: toRanking(singleCounts),
      groups: toRanking(groupCounts),
    }
  }, [castItems, annotations, tags])

  const characterRank = useMemo(() => {
    return tags
      .filter((tag) => tag.dimensionId === 'character' && (tagUsage[tag.id] ?? 0) > 0)
      .map((tag) => ({ id: tag.id, count: tagUsage[tag.id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  }, [tags, tagUsage])
  const characterTotal = characterRank.reduce((sum, row) => sum + row.count, 0)

  const pct = (count: number, total: number) => (total ? `${Math.round((count / total) * 100)}%` : '0%')
  const months = monthNames()
  const weekdays = weekdayNames()

  // 时间轴：星期分布、最活跃月份/年份、最长断更区间
  const timeline = useMemo(() => {
    const weekday = Array.from({ length: 7 }, () => 0)
    const monthTotals = Array.from({ length: 12 }, () => 0)
    const yearTotals = new Map<number, number>()
    const drawingDays = new Set<string>()
    let inferredItems = 0
    for (const item of items) {
      const d = getDate(item)
      if (!d.iso) continue
      if (!d.confirmed) inferredItems++
      drawingDays.add(d.iso)
      weekday[new Date(`${d.iso}T00:00:00`).getDay()]++
      if (d.month >= 1 && d.month <= 12) monthTotals[d.month - 1]++
      if (d.year) yearTotals.set(d.year, (yearTotals.get(d.year) ?? 0) + 1)
    }
    const sortedDays = [...drawingDays].sort()
    let gapDays = 0
    let gapFrom = ''
    let gapTo = ''
    for (let i = 1; i < sortedDays.length; i += 1) {
      const diff =
        Math.round(
          (Date.parse(`${sortedDays[i]}T00:00:00`) - Date.parse(`${sortedDays[i - 1]}T00:00:00`)) / 86400000,
        ) - 1
      if (diff > gapDays) {
        gapDays = diff
        gapFrom = sortedDays[i - 1]
        gapTo = sortedDays[i]
      }
    }
    const topMonthIndex = monthTotals.reduce((best, count, idx) => (count > monthTotals[best] ? idx : best), 0)
    const topYearEntry = [...yearTotals.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    return {
      weekday,
      drawingDays: drawingDays.size,
      inferredItems,
      gapDays,
      gapFrom,
      gapTo,
      topMonth: monthTotals[topMonthIndex] ? { index: topMonthIndex, count: monthTotals[topMonthIndex] } : null,
      topYear: topYearEntry ? { year: topYearEntry[0], count: topYearEntry[1] } : null,
    }
  }, [items, getDate])

  // 角色共现矩阵：取出场最多的若干角色，统计两两同框张数
  const cooc = useMemo(() => {
    const charTagIds = new Set(tags.filter((tag) => tag.dimensionId === 'character').map((tag) => tag.id))
    const itemCharacters = new Map<string, string[]>()
    const appearances = new Map<string, number>()
    for (const item of castItems) {
      const ids = [...new Set((annotations[item.id]?.tags ?? []).filter((id) => charTagIds.has(id)))]
      if (!ids.length) continue
      itemCharacters.set(item.id, ids)
      for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1)
    }
    const ids = [...appearances.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, COOC_LIMIT)
      .map(([id]) => id)
    if (ids.length < 2) return null
    const index = new Map(ids.map((id, i) => [id, i]))
    const matrix = ids.map(() => ids.map(() => 0))
    const totals = ids.map(() => 0)
    for (const itemIds of itemCharacters.values()) {
      const present = itemIds.filter((id) => index.has(id))
      for (const id of present) {
        const row = index.get(id)!
        totals[row]++
        for (const other of present) {
          if (other === id) continue
          matrix[row][index.get(other)!]++
        }
      }
    }
    let max = 1
    let topPair: { a: string; b: string; count: number } | null = null
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const count = matrix[i][j]
        if (count > max) max = count
        if (count && (!topPair || count > topPair.count)) topPair = { a: ids[i], b: ids[j], count }
      }
    }
    return { ids, matrix, totals, max, topPair }
  }, [castItems, annotations, tags])

  // 首末登场：按角色记录最早与最晚的作品
  const debuts = useMemo(() => {
    const charTagIds = new Set(tags.filter((tag) => tag.dimensionId === 'character').map((tag) => tag.id))
    const map = new Map<
      string,
      { count: number; first: { item: DiaryItem; date: string }; last: { item: DiaryItem; date: string } }
    >()
    for (const item of castItems) {
      const d = getDate(item)
      if (!d.iso) continue
      const ids = [...new Set((annotations[item.id]?.tags ?? []).filter((id) => charTagIds.has(id)))]
      for (const id of ids) {
        const entry = map.get(id)
        if (!entry) {
          map.set(id, { count: 1, first: { item, date: d.iso }, last: { item, date: d.iso } })
          continue
        }
        entry.count++
        if (d.iso < entry.first.date) entry.first = { item, date: d.iso }
        if (d.iso > entry.last.date) entry.last = { item, date: d.iso }
      }
    }
    return characterRank.flatMap((row) => {
      const entry = map.get(row.id)
      return entry ? [{ id: row.id, ...entry }] : []
    })
  }, [characterRank, castItems, annotations, tags, getDate])

  // 标签演变：选中维度下各标签按年份的出现次数
  const activeEvoDim =
    dimensions.find((dim) => dim.id === evoDim) ??
    dimensions.find((dim) => dim.id !== 'character') ??
    dimensions[0]
  const evolution = useMemo(() => {
    if (!activeEvoDim) return null
    const dimTags = tags.filter((tag) => tag.dimensionId === activeEvoDim.id)
    const dimTagIds = new Set(dimTags.map((tag) => tag.id))
    const years = yearCounts.map(([y]) => y)
    const byTag = new Map<string, Map<number, number>>()
    for (const item of items) {
      const y = getDate(item).year
      if (!y) continue
      for (const id of new Set(annotations[item.id]?.tags ?? [])) {
        if (!dimTagIds.has(id)) continue
        const counts = byTag.get(id) ?? new Map<number, number>()
        counts.set(y, (counts.get(y) ?? 0) + 1)
        byTag.set(id, counts)
      }
    }
    const rows = dimTags
      .map((tag) => {
        const counts = byTag.get(tag.id)
        const total = counts ? [...counts.values()].reduce((sum, n) => sum + n, 0) : 0
        return { tag, total, byYear: years.map((y) => counts?.get(y) ?? 0) }
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.tag.name.localeCompare(b.tag.name))
      .slice(0, 8)
    const max = Math.max(1, ...rows.flatMap((row) => row.byYear))
    return { dim: activeEvoDim, years, rows, max }
  }, [activeEvoDim, tags, items, annotations, getDate, yearCounts])

  // 文本画像：文案长度、高频词与 emoji（基于原始 caption，不做翻译）
  const textProfile = useMemo(() => {
    type SegmenterLike = {
      segment: (input: string) => Iterable<{ segment: string; isWordLike?: boolean }>
    }
    const SegmenterCtor = (
      Intl as unknown as {
        Segmenter?: new (locales?: string, options?: { granularity: 'word' }) => SegmenterLike
      }
    ).Segmenter
    const segmenter = SegmenterCtor ? new SegmenterCtor(undefined, { granularity: 'word' }) : null
    const buckets = [0, 0, 0, 0, 0]
    const wordCounts = new Map<string, number>()
    const emojiCounts = new Map<string, number>()
    const stopWords = new Set([
      'です', 'ます', 'ました', 'して', 'から', 'まで', 'より', 'など', 'よう', 'こと', 'もの',
      'これ', 'それ', 'あれ', '今日', '明日', '昨日',
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'you', 'are',
    ])
    let captions = 0
    for (const item of items) {
      const caption = (item.caption ?? '').trim()
      if (!caption) {
        buckets[0]++
        continue
      }
      captions++
      const length = [...caption].length
      if (length <= 20) buckets[1]++
      else if (length <= 50) buckets[2]++
      else if (length <= 100) buckets[3]++
      else buckets[4]++
      for (const emoji of caption.match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? []) {
        emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1)
      }
      const addWord = (raw: string) => {
        const word = raw.trim()
        if (word.length < 2 || stopWords.has(word.toLowerCase())) return
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1)
      }
      if (segmenter) {
        for (const part of segmenter.segment(caption)) {
          if (part.isWordLike) addWord(part.segment)
        }
      } else {
        const fallback =
          caption.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}|[A-Za-z][A-Za-z']{2,}/gu) ?? []
        for (const word of fallback) addWord(word)
      }
    }
    const top = (counts: Map<string, number>, limit: number) =>
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([text, count]) => ({ text, count }))
    return {
      buckets,
      captions,
      words: top(wordCounts, 16),
      emojis: top(emojiCounts, 12),
    }
  }, [items])

  // 数据可信度：确认/推断/无日期比例，以及跨月、跨年提示数量
  const trust = useMemo(() => {
    let confirmed = 0
    let inferred = 0
    let missing = 0
    let rolloverMonth = 0
    let rolloverYear = 0
    for (const item of items) {
      const d = getDate(item)
      if (!d.iso) missing++
      else if (d.confirmed) confirmed++
      else inferred++
      if (item.rollover === 'month') rolloverMonth++
      else if (item.rollover === 'year') rolloverYear++
    }
    return { confirmed, inferred, missing, rolloverMonth, rolloverYear, total: items.length }
  }, [items, getDate])

  const openCharacter = (id: string) => navigate(`/characters?char=${encodeURIComponent(id)}`)
  const charName = (id: string) => tagMap.get(id)?.name ?? id

  const castAvatarLink = (id: string) => (
    <button
      key={id}
      type="button"
      className="cast-avatar-btn"
      onClick={() => openCharacter(id)}
      title={t('stats.characterTooltip', { name: tagMap.get(id)?.name ?? id })}
    >
      {castAvatar(id)}
    </button>
  )

  const castNameLinks = (ids: string[]) =>
    ids.map((id, index) => (
      <span key={id}>
        <button type="button" className="cast-name-link" onClick={() => openCharacter(id)}>
          {tagMap.get(id)?.name ?? id}
        </button>
        {index < ids.length - 1 ? <span className="cast-sep"> × </span> : null}
      </span>
    ))

  const castAvatar = (id: string) => <CharacterAvatar tagId={id} className="cast-avatar" />

  return (
    <div className="stats-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.stats.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.stats.title')}</h2>
          <div className="page-sub">
            {t('stats.overview.subtitle', {
              from: summary.minDate,
              to: summary.maxDate,
              count: items.length,
              posts: summary.posts,
            })}
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="gallery" size={16} /></span>
            <span className="stat-label">{t('stats.cards.works')}</span>
          </div>
          <div className="stat-value num">{items.length}</div>
          <div className="stat-hint">{t('stats.cards.multiPosts', { count: summary.multi })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="calendar" size={16} /></span>
            <span className="stat-label">{t('stats.cards.drawingDays')}</span>
          </div>
          <div className="stat-value num">{summary.days}</div>
          <div className="stat-hint">{t('stats.cards.longestStreak', { count: summary.longest })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="tag" size={16} /></span>
            <span className="stat-label">{t('stats.cards.tagged')}</span>
          </div>
          <div className="stat-value num">{summary.tagged}</div>
          <div className="stat-hint">
            {IS_PUBLIC
              ? t('stats.cards.tagsCount', { count: tags.length })
              : t('stats.cards.tagsAndCollections', { tags: tags.length, collections: collections.length })}
          </div>
        </div>
        {IS_PUBLIC ? (
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><Icon name="users" size={16} /></span>
              <span className="stat-label">{t('stats.cards.characters')}</span>
            </div>
            <div className="stat-value num">{characterTotal}</div>
            <div className="stat-hint">{t('stats.cards.charactersHint', { count: characterRank.length })}</div>
          </div>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-icon"><Icon name="check" size={16} /></span>
                <span className="stat-label">{t('stats.cards.confirmedDates')}</span>
              </div>
              <div className="stat-value num">{summary.confirmed}</div>
              <div className="stat-hint">{t('stats.cards.pendingReview', { count: items.length - summary.confirmed })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-icon"><Icon name="heart" size={16} /></span>
                <span className="stat-label">{t('stats.cards.favorites')}</span>
              </div>
              <div className="stat-value num">{summary.favorites}</div>
              <div className="stat-hint">{t('stats.cards.favoritesHint', { count: summary.withNotes })}</div>
            </div>
          </>
        )}
      </div>

      <div className="stats-two">
        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.monthly.title')}</h3>
            <select className="select select-mini" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearCounts.map(([y]) => (
                <option key={y} value={y}>
                  {t('common.yearLabel', { year: y })}
                </option>
              ))}
            </select>
          </div>
          <div className="bar-chart">
            {monthCounts.map((count, idx) => (
              <div
                key={idx}
                className="bar-col"
                title={t('stats.monthly.barTooltip', { month: months[idx], count, days: monthDays[idx] })}
              >
                <span className="bar-value num">{count || ''}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${(count / maxMonth) * 100}%` }} />
                </div>
                <span className="bar-label">{idx + 1}</span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            {t('stats.monthly.hint')}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.yearly.title')}</h3>
          </div>
          <div className="year-table">
            {yearCounts.map(([y, count]) => (
              <div key={y} className="year-row">
                <span className="num">{y}</span>
                <div className="year-track">
                  <div className="year-fill" style={{ width: `${(count / maxYear) * 100}%` }} />
                </div>
                <span className="num">{count}</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <div className="meta-list">
            <div className="meta-row">
              <span>{t('stats.yearly.average')}</span>
              <span className="num">{t('common.itemCount', { count: (items.length / Math.max(1, summary.days)).toFixed(2) })}</span>
            </div>
            <div className="meta-row">
              <span>{t('stats.yearly.span')}</span>
              <span className="num">{summary.minDate} → {summary.maxDate}</span>
            </div>
            {!IS_PUBLIC && (
              <div className="meta-row">
                <span>{t('stats.yearly.localNotes')}</span>
                <span className="num">{t('stats.yearly.records', { count: Object.keys(data.items).length })}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.timeline.title')}</h3>
          <span className="faint">
            {t('stats.timeline.subtitle', { days: timeline.drawingDays, years: yearCounts.length })}
          </span>
        </div>
        <div className="timeline-highlights">
          <div className="timeline-highlight">
            <span className="timeline-highlight-label">{t('stats.timeline.topMonth')}</span>
            <strong>{timeline.topMonth ? months[timeline.topMonth.index] : '—'}</strong>
            <span className="num">
              {timeline.topMonth
                ? t('stats.timeline.monthValue', { count: timeline.topMonth.count })
                : t('stats.timeline.noData')}
            </span>
          </div>
          <div className="timeline-highlight">
            <span className="timeline-highlight-label">{t('stats.timeline.topYear')}</span>
            <strong>{timeline.topYear ? t('common.yearLabel', { year: timeline.topYear.year }) : '—'}</strong>
            <span className="num">
              {timeline.topYear ? t('common.itemCount', { count: timeline.topYear.count }) : t('stats.timeline.noData')}
            </span>
          </div>
          <div className="timeline-highlight">
            <span className="timeline-highlight-label">{t('stats.timeline.longestGap')}</span>
            <strong>{timeline.gapDays ? t('stats.timeline.gapValue', { days: timeline.gapDays }) : '—'}</strong>
            <span className="num">
              {timeline.gapDays
                ? t('stats.timeline.gapRange', {
                    from: formatShortDate(timeline.gapFrom),
                    to: formatShortDate(timeline.gapTo),
                  })
                : t('stats.timeline.gapNone')}
            </span>
          </div>
        </div>
        <div className="weekday-chart">
          {timeline.weekday.map((count, idx) => (
            <div
              key={idx}
              className="weekday-col"
              title={t('stats.timeline.weekdayTooltip', { weekday: weekdays[idx], count })}
            >
              <span className="weekday-value num">{count || ''}</span>
              <div className="weekday-track">
                <div
                  className="weekday-fill"
                  style={{ height: `${(count / Math.max(1, ...timeline.weekday)) * 100}%` }}
                />
              </div>
              <span className="weekday-label">{weekdays[idx]}</span>
            </div>
          ))}
        </div>
        <p className="stats-note">
          {IS_PUBLIC
            ? t('stats.dateBasis.public')
            : t('stats.dateBasis.inferred', { count: timeline.inferredItems })}
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.tags.title')}</h3>
          <span className="faint">{t('stats.tags.subtitle')}</span>
        </div>
        {tagGroups.length ? (
          <div className="tag-dist-grid">
            {tagGroups.map(({ dim, tags: groupTags }) => {
              const open = openDims[dim.id] ?? false
              const groupTotal = groupTags.reduce((sum, tag) => sum + (tagUsage[tag.id] ?? 0), 0)
              const groupMax = Math.max(1, ...groupTags.map((tag) => tagUsage[tag.id] ?? 0))
              return (
                <div key={dim.id} className={`tag-dist${open ? ' is-open' : ''}`}>
                  <button
                    className="tag-dist-head"
                    onClick={() => setOpenDims((prev) => ({ ...prev, [dim.id]: !open }))}
                    aria-expanded={open}
                  >
                    <span className="field-label">{dim.name}</span>
                    <span className="num faint">{t('stats.tags.groupCount', { items: groupTags.length, uses: groupTotal })}</span>
                    <span className="tag-dist-caret" aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                  {open && (
                    <div className="tag-bars">
                      {groupTags.map((tag) => {
                        const count = tagUsage[tag.id] ?? 0
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className="tag-bar"
                            title={t('stats.tags.barTooltip', { name: tag.name, count })}
                            onClick={() => navigate(`/gallery?tag=${encodeURIComponent(tag.id)}`)}
                          >
                            <span className="tag-bar-track">
                              <span
                                className="tag-bar-fill"
                                style={{ height: `${(count / groupMax) * 100}%`, background: tag.color }}
                              />
                            </span>
                            <span className="num tag-bar-value">{count}</span>
                            <span className="tag-bar-name">{tag.name}</span>
                            <span className="tag-bar-avatar">{castAvatar(tag.id)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="faint">
            {cast.total > 0
              ? IS_PUBLIC
                ? t('stats.tags.emptyOthersPublic')
                : t('stats.tags.emptyOthers')
              : IS_PUBLIC
                ? t('stats.tags.emptyPublic')
                : t('stats.tags.empty')}
          </p>
        )}
      </section>

      {IS_PUBLIC && (
        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.castRank.title')}</h3>
            <span className="faint">
              {t('stats.castRank.subtitle', { characters: characterRank.length, count: characterTotal })}
            </span>
          </div>
          {characterRank.length ? (
            <div className="cast-pairs">
              {characterRank.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rank-row"
                  onClick={() => openCharacter(row.id)}
                  title={t('stats.characterTooltip', { name: tagMap.get(row.id)?.name ?? row.id })}
                >
                  <span className="cast-avatar-btn">{castAvatar(row.id)}</span>
                  <span className="rank-name">{tagMap.get(row.id)?.name ?? row.id}</span>
                  <span className="cast-pair-track">
                    <span
                      className="cast-pair-fill"
                      style={{ width: `${(row.count / Math.max(1, characterRank[0].count)) * 100}%` }}
                    />
                  </span>
                  <span className="num cast-pair-count">
                    {t('stats.castRank.count', { count: row.count, percent: pct(row.count, characterTotal) })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="faint">{t('stats.castRank.empty')}</p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.cast.title')}</h3>
          <span className="faint">
            {IS_PUBLIC
              ? t('stats.cast.subtitlePublic', { count: cast.total })
              : t('stats.cast.subtitle', { count: cast.total })}
          </span>
        </div>
        <div className="cast-chart">
          <div className="cast-donut">
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <circle className="cast-donut-track" cx="80" cy="80" r={CAST_RADIUS} />
              {(() => {
                let acc = 0
                return (
                  [
                    { key: 'single', count: cast.single, label: t('stats.cast.single'), color: 'var(--accent)' },
                    { key: 'double', count: cast.double, label: t('stats.cast.double'), color: 'var(--sage)' },
                    { key: 'multi', count: cast.multi, label: t('stats.cast.multi'), color: 'var(--gold)' },
                  ] as const
                ).map((seg) => {
                  const frac = cast.total ? seg.count / cast.total : 0
                  const dash = frac * CAST_CIRC
                  const offset = -acc * CAST_CIRC
                  acc += frac
                  if (dash <= 0) return null
                  const active = castTab === seg.key || hoveredCast === seg.key
                  const dim = hoveredCast !== null && hoveredCast !== seg.key
                  return (
                    <circle
                      key={seg.key}
                      className={`cast-donut-seg${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`}
                      cx="80"
                      cy="80"
                      r={CAST_RADIUS}
                      stroke={seg.color}
                      strokeWidth={active ? 24 : 17}
                      strokeDasharray={`${Math.max(dash - 2, 0.5)} ${CAST_CIRC - Math.max(dash - 2, 0.5)}`}
                      strokeDashoffset={offset}
                      onMouseEnter={() => setHoveredCast(seg.key)}
                      onMouseLeave={() => setHoveredCast(null)}
                      onClick={() => changeCastTab(seg.key)}
                    >
                      <title>{`${seg.label} · ${seg.count} · ${pct(seg.count, cast.total)}`}</title>
                    </circle>
                  )
                })
              })()}
            </svg>
            <div className="cast-donut-center">
              <strong className="num">{cast.total}</strong>
              <span>{t('stats.cast.centerHint')}</span>
            </div>
          </div>
          <div className="cast-legend" role="tablist" aria-label={t('stats.cast.chartAria')}>
            {(
              [
                { key: 'single', label: t('stats.cast.single'), count: cast.single, hint: t('stats.cast.singleHint'), color: 'var(--accent)' },
                { key: 'double', label: t('stats.cast.double'), count: cast.double, hint: t('stats.cast.doubleHint'), color: 'var(--sage)' },
                { key: 'multi', label: t('stats.cast.multi'), count: cast.multi, hint: t('stats.cast.multiHint'), color: 'var(--gold)' },
              ] as const
            ).map((tabItem) => (
              <button
                key={tabItem.key}
                role="tab"
                aria-selected={castTab === tabItem.key}
                className={`cast-legend-row${castTab === tabItem.key ? ' active' : ''}${
                  hoveredCast !== null && hoveredCast !== tabItem.key ? ' is-dim' : ''
                }`}
                onMouseEnter={() => setHoveredCast(tabItem.key)}
                onMouseLeave={() => setHoveredCast(null)}
                onFocus={() => setHoveredCast(tabItem.key)}
                onBlur={() => setHoveredCast(null)}
                onClick={() => changeCastTab(tabItem.key)}
              >
                <span className="cast-legend-swatch" style={{ background: tabItem.color }} />
                <span className="cast-legend-text">
                  <b>{tabItem.label}</b>
                  <span>{tabItem.hint}</span>
                </span>
                <span className="cast-legend-value">
                  <b className="num">{tabItem.count}</b>
                  <span>{pct(tabItem.count, cast.total)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {castTab === 'single' &&
          (cast.singles.length ? (
            <>
              <p className="cast-note">{t('stats.cast.singleNote', { total: cast.total })}</p>
              <div className="cast-pairs">
                {cast.singles.map((row) => (
                  <div key={row.ids[0]} className="cast-pair-row">
                    <span className="cast-pair-who">{castAvatarLink(row.ids[0])}</span>
                    <span className="cast-pair-name">{castNameLinks(row.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(row.count / Math.max(1, cast.singles[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: row.count, percent: pct(row.count, cast.single) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.singleEmptyPublic') : t('stats.cast.singleEmpty')}
            </p>
          ))}

        {castTab === 'double' &&
          (cast.pairs.length ? (
            <>
              <p className="cast-note">{t('stats.cast.doubleNote', { count: cast.pairImages })}</p>
              <div className="cast-pairs">
                {cast.pairs.map((pair) => (
                  <div key={pair.ids.join('|')} className="cast-pair-row">
                    <span className="cast-pair-who">
                      {castAvatarLink(pair.ids[0])}
                      {castAvatarLink(pair.ids[1])}
                    </span>
                    <span className="cast-pair-name">{castNameLinks(pair.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(pair.count / Math.max(1, cast.pairs[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: pair.count, percent: pct(pair.count, cast.pairImages) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.doubleEmptyPublic') : t('stats.cast.doubleEmpty')}
            </p>
          ))}

        {castTab === 'multi' &&
          (cast.groups.length ? (
            <>
              <p className="cast-note">{t('stats.cast.multiNote')}</p>
              <div className="cast-pairs">
                {cast.groups.map((group) => (
                  <div key={group.ids.join('|')} className="cast-pair-row is-group">
                    <span className="cast-pair-who">
                      {group.ids.slice(0, 3).map((id) => castAvatarLink(id))}
                    </span>
                    <span className="cast-pair-name">{castNameLinks(group.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(group.count / Math.max(1, cast.groups[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: group.count, percent: pct(group.count, cast.multi) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.multiEmptyPublic') : t('stats.cast.multiEmpty')}
            </p>
          ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.cooc.title')}</h3>
          <span className="faint">{t('stats.cooc.subtitle')}</span>
        </div>
        {cooc ? (
          <>
            <div className="cooc-scroll">
              <table className="cooc-table">
                <thead>
                  <tr>
                    <th aria-hidden="true" />
                    {cooc.ids.map((id) => (
                      <th key={id}>
                        <button
                          type="button"
                          className="cooc-head-btn"
                          onClick={() => openCharacter(id)}
                          title={t('stats.characterTooltip', { name: charName(id) })}
                        >
                          {castAvatar(id)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cooc.ids.map((rowId, rowIndex) => (
                    <tr key={rowId}>
                      <th scope="row">
                        <span className="cooc-row-head">
                          {castAvatarLink(rowId)}
                          <button type="button" className="cast-name-link cooc-row-name" onClick={() => openCharacter(rowId)}>
                            {charName(rowId)}
                          </button>
                        </span>
                      </th>
                      {cooc.ids.map((colId, colIndex) => {
                        const count = cooc.matrix[rowIndex][colIndex]
                        if (rowIndex === colIndex) {
                          return (
                            <td key={colId}>
                              <button
                                type="button"
                                className="cooc-cell is-diag"
                                onClick={() => openCharacter(rowId)}
                                title={t('stats.cooc.diagTooltip', { name: charName(rowId), count: cooc.totals[rowIndex] })}
                              >
                                {cooc.totals[rowIndex]}
                              </button>
                            </td>
                          )
                        }
                        const strength = count ? 10 + Math.round((count / cooc.max) * 65) : 0
                        return (
                          <td key={colId}>
                            <button
                              type="button"
                              className={`cooc-cell${count ? '' : ' is-empty'}`}
                              disabled={!count}
                              style={
                                count
                                  ? {
                                      background: `color-mix(in srgb, var(--accent) ${strength}%, transparent)`,
                                      color: strength > 45 ? '#fff' : undefined,
                                    }
                                  : undefined
                              }
                              onClick={() =>
                                navigate(
                                  `/gallery?tags=${encodeURIComponent(rowId)},${encodeURIComponent(colId)}&tagMode=all`,
                                )
                              }
                              title={t('stats.cooc.cellTooltip', {
                                a: charName(rowId),
                                b: charName(colId),
                                count,
                              })}
                            >
                              {count || '·'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cooc-foot">
              <span className="faint">{t('stats.cooc.hint', { count: cooc.ids.length })}</span>
              {cooc.topPair && (
                <button
                  type="button"
                  className="cooc-top"
                  onClick={() =>
                    navigate(
                      `/gallery?tags=${encodeURIComponent(cooc.topPair!.a)},${encodeURIComponent(cooc.topPair!.b)}&tagMode=all`,
                    )
                  }
                >
                  {t('stats.cooc.topPair', {
                    a: charName(cooc.topPair.a),
                    b: charName(cooc.topPair.b),
                    count: cooc.topPair.count,
                  })}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="faint">{t('stats.cooc.empty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.debut.title')}</h3>
          <span className="faint">{t('stats.debut.subtitle')}</span>
        </div>
        {debuts.length ? (
          <>
            <div className="debut-list">
              {debuts.map((entry) => (
                <div key={entry.id} className="debut-row">
                  <span className="debut-who">
                    {castAvatarLink(entry.id)}
                    <button type="button" className="cast-name-link debut-name" onClick={() => openCharacter(entry.id)}>
                      {charName(entry.id)}
                    </button>
                  </span>
                  <span className="debut-count num faint">
                    {t('stats.debut.occurrences', { count: entry.count })}
                  </span>
                  {(['first', 'last'] as const).map((kind) => {
                    const shot = kind === 'first' ? entry.first : entry.last
                    return (
                      <button
                        key={kind}
                        type="button"
                        className="debut-shot"
                        onClick={() => navigate(`/item/${shot.item.id}`)}
                        title={t('stats.debut.open', { date: formatFullDate(shot.date) })}
                      >
                        <img src={`${BASE}${shot.item.thumb}`} alt="" loading="lazy" decoding="async" />
                        <span className="debut-shot-text">
                          <i>{t(kind === 'first' ? 'stats.debut.first' : 'stats.debut.last')}</i>
                          <b>{formatShortDate(shot.date)}</b>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <p className="stats-note">
              {IS_PUBLIC
                ? t('stats.dateBasis.public')
                : t('stats.dateBasis.inferred', { count: timeline.inferredItems })}
            </p>
          </>
        ) : (
          <p className="faint">{IS_PUBLIC ? t('stats.debut.emptyPublic') : t('stats.debut.empty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.evolution.title')}</h3>
          <span className="faint">{t('stats.evolution.subtitle')}</span>
        </div>
        {dimensions.length > 0 && (
          <div className="evo-tabs">
            {dimensions.map((dim) => (
              <button
                key={dim.id}
                type="button"
                className={`evo-tab${evolution?.dim.id === dim.id ? ' active' : ''}`}
                onClick={() => setEvoDim(dim.id)}
              >
                {dim.name}
              </button>
            ))}
          </div>
        )}
        {evolution && evolution.rows.length ? (
          <>
            <div className="evo-scroll">
              <table className="evo-table">
                <thead>
                  <tr>
                    <th className="evo-tag-head">{t('stats.evolution.tag')}</th>
                    {evolution.years.map((y) => (
                      <th key={y} className="num">
                        {y}
                      </th>
                    ))}
                    <th className="num">{t('stats.evolution.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.rows.map((row) => (
                    <tr key={row.tag.id}>
                      <th scope="row">
                        <span className="evo-tag">
                          <i style={{ background: row.tag.color }} />
                          <span className="evo-tag-name">{row.tag.name}</span>
                        </span>
                      </th>
                      {row.byYear.map((count, index) => (
                        <td key={evolution.years[index]}>
                          <span
                            className={`evo-cell${count ? '' : ' is-empty'}`}
                            style={
                              count
                                ? {
                                    background: `color-mix(in srgb, var(--sage) ${8 + Math.round((count / evolution.max) * 62)}%, transparent)`,
                                  }
                                : undefined
                            }
                            title={t('stats.evolution.cellTooltip', {
                              tag: row.tag.name,
                              year: evolution.years[index],
                              count,
                            })}
                          >
                            {count || ''}
                          </span>
                        </td>
                      ))}
                      <td className="num evo-total">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stats-note">
              {IS_PUBLIC
                ? t('stats.dateBasis.public')
                : t('stats.dateBasis.inferred', { count: timeline.inferredItems })}
            </p>
          </>
        ) : (
          <p className="faint">{t('stats.evolution.empty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.text.title')}</h3>
          <span className="faint">{t('stats.text.subtitle')}</span>
        </div>
        {textProfile.captions ? (
          <div className="text-profile">
            <div className="text-profile-block">
              <h4>{t('stats.text.captionLength')}</h4>
              <div className="length-bars">
                {textProfile.buckets.map((count, index) => (
                  <div className="length-row" key={TEXT_BUCKET_KEYS[index]}>
                    <span className="length-label">{t(TEXT_BUCKET_KEYS[index])}</span>
                    <span className="length-track">
                      <span
                        className={`length-fill${index === 0 ? ' is-empty' : ''}`}
                        style={{ width: `${(count / Math.max(1, ...textProfile.buckets)) * 100}%` }}
                      />
                    </span>
                    <span className="num length-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-profile-block">
              <h4>{t('stats.text.words')}</h4>
              {textProfile.words.length ? (
                <div className="word-cloud">
                  {textProfile.words.map((word) => (
                    <span className="word-pill" key={word.text}>
                      {word.text}
                      <i className="num">{word.count}</i>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="faint">{t('stats.text.emptyWords')}</p>
              )}
            </div>
            <div className="text-profile-block">
              <h4>{t('stats.text.emoji')}</h4>
              {textProfile.emojis.length ? (
                <div className="emoji-cloud">
                  {textProfile.emojis.map((emoji) => (
                    <span
                      className="emoji-pill"
                      key={emoji.text}
                      title={t('stats.text.count', { count: emoji.count })}
                    >
                      <span className="emoji-glyph">{emoji.text}</span>
                      <i className="num">{emoji.count}</i>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="faint">{t('stats.text.emptyEmoji')}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="faint">{t('stats.text.empty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.trust.title')}</h3>
          <span className="faint">{t('stats.trust.subtitle')}</span>
        </div>
        {trust.total ? (
          <>
            <div
              className="trust-bar"
              role="img"
              aria-label={t('stats.trust.barAria', {
                confirmed: trust.confirmed,
                inferred: trust.inferred,
                missing: trust.missing,
              })}
            >
              {trust.confirmed > 0 && (
                <span className="trust-seg is-confirmed" style={{ flexGrow: trust.confirmed }} />
              )}
              {trust.inferred > 0 && (
                <span className="trust-seg is-inferred" style={{ flexGrow: trust.inferred }} />
              )}
              {trust.missing > 0 && <span className="trust-seg is-missing" style={{ flexGrow: trust.missing }} />}
            </div>
            <div className="trust-legend">
              <span>
                <i className="trust-dot is-confirmed" />
                {t('stats.trust.confirmed', {
                  count: trust.confirmed,
                  percent: pct(trust.confirmed, trust.total),
                })}
              </span>
              <span>
                <i className="trust-dot is-inferred" />
                {t('stats.trust.inferred', {
                  count: trust.inferred,
                  percent: pct(trust.inferred, trust.total),
                })}
              </span>
              <span>
                <i className="trust-dot is-missing" />
                {t('stats.trust.missing', {
                  count: trust.missing,
                  percent: pct(trust.missing, trust.total),
                })}
              </span>
            </div>
            <div className="trust-rollover">
              <div className="trust-card">
                <span>{t('stats.trust.rolloverMonth')}</span>
                <strong className="num">{trust.rolloverMonth}</strong>
              </div>
              <div className="trust-card">
                <span>{t('stats.trust.rolloverYear')}</span>
                <strong className="num">{trust.rolloverYear}</strong>
              </div>
            </div>
            <p className="stats-note">
              {IS_PUBLIC ? t('stats.dateBasis.public') : t('stats.trust.note')}
            </p>
          </>
        ) : (
          <p className="faint">{t('stats.timeline.noData')}</p>
        )}
      </section>
    </div>
  )
}
