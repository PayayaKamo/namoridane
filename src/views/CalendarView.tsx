import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import {
  MONTHS_CN,
  WEEKDAYS_CN,
  daysInMonth,
  effectiveDate,
  firstWeekday,
  isoOf,
  todayKey,
} from '../lib/dates'
import { Icon } from '../components/Icon'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL
type CalFilter = 'all' | 'filled' | 'missing' | 'favorite' | 'pending'

export function CalendarView({ route }: { route: Route }) {
  const { items, annotations, years, getDate } = useStore()
  const latestYear = Number(years[years.length - 1] ?? new Date().getFullYear())
  const initialYear = Number(route.query.get('y')) || Number(route.query.get('year')) || latestYear
  const initialMonth = Number(route.query.get('m')) || Number(route.query.get('month')) || new Date().getMonth() + 1
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [filter, setFilter] = useState<CalFilter>('all')

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

  const step = (delta: number) => {
    const next = month + delta
    if (next < 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else if (next > 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth(next)
    }
  }

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
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Calendar</div>
          <h2 className="page-title">
            {year} 年 {MONTHS_CN[month - 1]}
          </h2>
          <div className="page-sub">
            本月 {dayCount} 天有画 · 共 {total} 张 · 缺 {days - dayCount} 天
          </div>
        </div>
        <div className="page-actions">
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="上个月">
              <Icon name="left" />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                const now = new Date()
                setYear(now.getFullYear())
                setMonth(now.getMonth() + 1)
              }}
            >
              今天
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="下个月">
              <Icon name="right" />
            </button>
          </div>
          <select className="select" style={{ width: 104 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 96 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS_CN.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="month"
            className="input"
            style={{ width: 148 }}
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (y && m) {
                setYear(y)
                setMonth(m)
              }
            }}
          />
          <button className="btn btn-sm" onClick={() => window.print()} title="打印当前月历">
            <Icon name="download" />
            打印月历
          </button>
        </div>
      </div>

      {!items.length && (
        <div className="excluded-banner">
          <div>
            <strong>还没有图片</strong>
            <span>
              运行 <code>npm run import -- "&lt;解压目录&gt;"</code> 导入图片，再执行 <code>npm run data</code> 生成索引后，日历会按确认的日期填充。
            </span>
          </div>
        </div>
      )}

      <div className="print-only print-head">
        <h1>Namori 绘日记 · {year} 年 {MONTHS_CN[month - 1]}</h1>
        <p>本月 {dayCount} 天有画 · 共 {total} 张</p>
      </div>

      <div className="year-strip">
        {monthCounts.map((count, idx) => (
          <button
            key={idx}
            className={`year-month${idx + 1 === month ? ' active' : ''}${count ? '' : ' empty-month'}`}
            onClick={() => setMonth(idx + 1)}
            title={`${MONTHS_CN[idx]} · ${count} 张`}
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
              ['all', '全部'],
              ['filled', '有图'],
              ['missing', '缺图'],
              ['favorite', '收藏'],
              ['pending', '待校对'],
            ] as [CalFilter, string][]
          ).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="cal-legend">
          <span><i className="legend-dot filled" />有画</span>
          <span><i className="legend-dot empty" />缺</span>
          <span><i className="legend-dot pending" />待校对</span>
        </div>
      </div>

      <div className="cal-grid">
        {WEEKDAYS_CN.map((w) => (
          <div key={w} className="cal-weekday">
            周{w}
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
                {day === 1 && <span className="cal-month-tag">{month}月</span>}
                <span className="spacer" />
                {pending && list.length > 0 && <span className="dot-warn" title="有未校对日期" />}
                {list.length > 3 && <span className="cal-count num">{list.length}</span>}
              </div>
              <div className="cal-thumbs">
                {visible.slice(0, 3).map((item) => (
                  <div key={item.id} className="cal-thumb" style={{ background: item.color }}>
                    <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" decoding="async" />
                  </div>
                ))}
                {!list.length && <div className="cal-empty-hint">—</div>}
                {list.length > 3 && <div className="cal-more">+{list.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
