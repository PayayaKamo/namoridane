import { useEffect, useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import {
  daysInMonth,
  effectiveDate,
  firstWeekday,
  isoOf,
  monthNames,
  todayKey,
  weekdayNames,
} from '../lib/dates'
import { Icon } from '../components/Icon'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'
import type { DiaryItem, EffectiveDate } from '../types'

const BASE = import.meta.env.BASE_URL
const CALENDAR_MONTH_KEY = 'namori.calendar.month'
type CalFilter = 'all' | 'filled' | 'missing' | 'favorite' | 'pending'

/** 读取用户上一次手动选择的月份；未选择过或数据损坏时返回 null */
function readStoredMonth(): { year: number; month: number } | null {
  try {
    const raw = localStorage.getItem(CALENDAR_MONTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { year?: unknown; month?: unknown }
    const year = Number(parsed?.year)
    const month = Number(parsed?.month)
    if (Number.isInteger(year) && year > 0 && month >= 1 && month <= 12) return { year, month }
  } catch {
    // 忽略损坏的本地记录
  }
  return null
}

/**
 * 首屏定位：当前年月有内容就保持；否则优先取最近一个同月份有内容的年份；
 * 再退到距离当前最近的有内容月份；都没有则留在当前年月。
 */
function resolveInitialMonth(
  items: DiaryItem[],
  getDate: (item: DiaryItem) => EffectiveDate,
  now: Date,
): { year: number; month: number } {
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1
  const months = new Set<string>()
  const sameMonthYears = new Set<number>()
  let hasNow = false
  for (const item of items) {
    const d = getDate(item)
    if (!d.year || !d.month) continue
    months.add(`${d.year}-${d.month}`)
    if (d.year === nowYear && d.month === nowMonth) hasNow = true
    if (d.month === nowMonth) sameMonthYears.add(d.year)
  }
  if (hasNow) return { year: nowYear, month: nowMonth }
  if (sameMonthYears.size) {
    let bestYear = nowYear
    let bestDistance = Infinity
    for (const y of sameMonthYears) {
      const distance = Math.abs(y - nowYear)
      if (distance < bestDistance || (distance === bestDistance && y > bestYear)) {
        bestYear = y
        bestDistance = distance
      }
    }
    return { year: bestYear, month: nowMonth }
  }
  let best = { year: nowYear, month: nowMonth }
  let bestDistance = Infinity
  for (const key of months) {
    const [y, m] = key.split('-').map(Number)
    const distance = Math.abs(y * 12 + m - (nowYear * 12 + nowMonth))
    if (distance < bestDistance) {
      bestDistance = distance
      best = { year: y, month: m }
    }
  }
  return best
}

export function CalendarView({ route }: { route: Route }) {
  const { items, annotations, years, getDate, seedReady } = useStore()
  const { t } = useI18n()
  const months = monthNames()
  const weekdays = weekdayNames()
  const [initial] = useState(() => {
    const now = new Date()
    const queryYear = Number(route.query.get('y')) || Number(route.query.get('year'))
    const queryMonth = Number(route.query.get('m')) || Number(route.query.get('month'))
    const stored = readStoredMonth()
    return {
      year: queryYear || stored?.year || now.getFullYear(),
      month: queryMonth || stored?.month || now.getMonth() + 1,
      // URL 参数或历史选择都表示用户已明确指定，不再自动定位
      explicit: Boolean(queryYear || queryMonth || stored),
    }
  })
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [positioned, setPositioned] = useState(initial.explicit)
  const [filter, setFilter] = useState<CalFilter>('all')

  const selectMonth = (nextYear: number, nextMonth: number) => {
    setPositioned(true)
    setYear(nextYear)
    setMonth(nextMonth)
    try {
      localStorage.setItem(CALENDAR_MONTH_KEY, JSON.stringify({ year: nextYear, month: nextMonth }))
    } catch {
      // 本地存储不可用时仍然允许浏览
    }
  }

  // 索引与公开种子异步载入：两者都就绪后只自动定位一次；用户已选择过则跳过
  useEffect(() => {
    if (positioned || !seedReady || !items.length) return
    const target = resolveInitialMonth(items, getDate, new Date())
    setPositioned(true)
    if (target.year !== year || target.month !== month) {
      setYear(target.year)
      setMonth(target.month)
    }
  }, [items, getDate, positioned, seedReady, year, month])

  const byDay = useMemo(() => {
    const map = new Map<string, DiaryItem[]>()
    for (const item of items) {
      const d = getDate(item)
      if (d.year !== year || d.month !== month) continue
      const key = d.iso
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    for (const list of map.values()) list.sort((a, b) => a.postIndex - b.postIndex)
    return map
  }, [items, getDate, year, month])

  const matches = (item: DiaryItem) => {
    const ann = annotations[item.id]
    const d = effectiveDate(item, ann)
    if (filter === 'favorite') return Boolean(ann?.favorite)
    if (filter === 'pending') return !d.confirmed
    return true
  }

  const dayCount = byDay.size
  const total = [...byDay.values()].reduce((sum, list) => sum + list.length, 0)
  const days = daysInMonth(year, month)
  const lead = firstWeekday(year, month)
  const today = todayKey()

  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  // 年份下拉保持连续区间：最早有数据的年份 → 当前年份（含无数据年份），并纳入未来数据
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const candidates = years.map(Number).filter((value) => Number.isInteger(value) && value > 0)
    if (!candidates.length) candidates.push(currentYear)
    const min = Math.min(currentYear, ...candidates)
    const max = Math.max(currentYear, ...candidates)
    return Array.from({ length: max - min + 1 }, (_, index) => min + index)
  }, [years])

  const stepYear = (delta: number) => {
    const min = yearOptions[0]
    const max = yearOptions[yearOptions.length - 1]
    const next = year + delta
    if (!Number.isInteger(next) || next < min || next > max) return
    selectMonth(next, month)
  }

  // 日历页快捷键：← → 切换年份（与标题两侧按钮一致）；输入框/下拉聚焦时不拦截
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      stepYear(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [year, month, yearOptions])

  // 月份统计
  const monthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    for (const item of items) {
      const d = getDate(item)
      if (d.year === year) counts[d.month - 1]++
    }
    return counts
  }, [items, getDate, year])

  return (
    <div className="calendar-view">
      <div className="cal-sticky">
        <div className="page-eyebrow">{t('shell.page.calendar.eyebrow')}</div>
        <div className="cal-title-row">
          <button
            className="icon-btn"
            onClick={() => stepYear(-1)}
            aria-label={t('browse.calendar.prevYear')}
            title={t('browse.calendar.prevYearHint')}
          >
            <Icon name="left" />
          </button>
          <h2 className="page-title">{t('browse.calendar.heading', { year, month: months[month - 1] })}</h2>
          <button
            className="icon-btn"
            onClick={() => stepYear(1)}
            aria-label={t('browse.calendar.nextYear')}
            title={t('browse.calendar.nextYearHint')}
          >
            <Icon name="right" />
          </button>
        </div>
        <div className="page-sub">
          {t('browse.calendar.summary', { days: dayCount, total, missing: days - dayCount })}
        </div>
      </div>
      <div className="cal-controls">
        <select className="select" style={{ width: 104 }} value={year} onChange={(e) => selectMonth(Number(e.target.value), month)}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {t('common.yearLabel', { year: y })}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 96 }} value={month} onChange={(e) => selectMonth(year, Number(e.target.value))}>
          {months.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          onClick={() => {
            const now = new Date()
            selectMonth(now.getFullYear(), now.getMonth() + 1)
          }}
        >
          {t('browse.calendar.today')}
        </button>
        <button className="btn btn-sm" onClick={() => window.print()} title={t('browse.calendar.printHint')}>
          <Icon name="download" />
          {t('browse.calendar.print')}
        </button>
      </div>

      {!items.length && (
        <div className="excluded-banner">
          {IS_PUBLIC ? (
            <div>
              <strong>{t('browse.calendar.emptyPublicTitle')}</strong>
              <span>{t('browse.calendar.emptyPublicHint')}</span>
            </div>
          ) : (
            <div>
              <strong>{t('browse.calendar.emptyTitle')}</strong>
              <span>
                {t('browse.calendar.emptyHintBefore')}{' '}
                <code>npm run import -- "{t('browse.calendar.importPlaceholder')}"</code>{' '}
                {t('browse.calendar.emptyHintMiddle')} <code>npm run data</code>{' '}
                {t('browse.calendar.emptyHintAfter')}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="print-only print-head">
        <h1>{t('browse.calendar.printTitle', { year, month: months[month - 1] })}</h1>
        <p>{t('browse.calendar.printSummary', { days: dayCount, total })}</p>
      </div>

      <div className="year-strip">
        {monthCounts.map((count, idx) => (
          <button
            key={idx}
            className={`year-month${idx + 1 === month ? ' active' : ''}${count ? '' : ' empty-month'}`}
            onClick={() => selectMonth(year, idx + 1)}
            title={t('browse.calendar.monthTooltip', { month: months[idx], count })}
          >
            <span>{idx + 1}</span>
            <span className="year-month-bar" style={{ opacity: count ? Math.min(1, 0.25 + count / 30) : 0.12 }} />
            <span className="year-month-count num">{count || ''}</span>
          </button>
        ))}
      </div>

      <div className="cal-toolbar">
        <div className="segmented">
          {(
            [
              ['all', t('common.all')],
              ['filled', t('browse.calendar.filterFilled')],
              ['missing', t('browse.calendar.filterMissing')],
              ['favorite', t('browse.calendar.filterFavorite')],
              ['pending', t('browse.calendar.filterPending')],
            ] as [CalFilter, string][]
          ).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-grid">
        {weekdays.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} className="cal-cell is-blank" />
          const iso = isoOf(year, month, day)
          const list = byDay.get(iso) ?? []
          const visible = list.filter(matches)
          const dimmed = filter !== 'all' ? visible.length === 0 : false
          const missingHighlight = filter === 'missing' && list.length === 0
          const pending = list.some((item) => !effectiveDate(item, annotations[item.id]).confirmed)
          return (
            <div
              key={iso}
              className={`cal-cell${iso === today ? ' is-today' : ''}${dimmed ? ' dimmed' : ''}${
                missingHighlight ? ' missing-hit' : ''
              }`}
              onClick={() =>
                navigate(
                  `/datefind?md=${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}&y=${year}`,
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                navigate(
                  `/datefind?md=${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}&y=${year}`,
                )
              }
            >
              <div className="cal-day">
                <span className={`hand${day === 1 ? ' first' : ''}`}>{day}</span>
                {day === 1 && <span className="cal-month-tag">{months[month - 1]}</span>}
                <span className="spacer" />
                {pending && list.length > 0 && (
                  <span className="dot-warn" title={t('browse.calendar.pendingHint')} />
                )}
                {list.length > 3 && <span className="cal-count num">{list.length}</span>}
              </div>
              <div className="cal-thumbs">
                {visible.slice(0, 3).map((item, thumbIndex) => (
                  <div key={item.id} className="cal-thumb" style={{ background: item.color }}>
                    <img
                      src={`${BASE}${item.thumb}`}
                      alt={t('browse.calendar.thumbAlt', { date: iso, count: thumbIndex + 1 })}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
                {list.length > 3 && <div className="cal-more">+{list.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
