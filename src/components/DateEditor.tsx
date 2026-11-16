import { useEffect, useState } from 'react'
import type { DiaryItem } from '../types'
import { useStore } from '../state/store'
import { formatMonthDay, isValidYmd, parseISO, suggestedDate } from '../lib/dates'
import { Icon } from './Icon'

export function DateEditor({ item, compact }: { item: DiaryItem; compact?: boolean }) {
  const { annotations, getDate, setManualDate, confirmDate, setDateOverride, notify } = useStore()
  const annotation = annotations[item.id]
  const current = getDate(item)
  const [month, setMonth] = useState(String(current.month))
  const [day, setDay] = useState(String(current.day))
  const [year, setYear] = useState(String(current.year))

  useEffect(() => {
    setMonth(String(current.month))
    setDay(String(current.day))
    setYear(String(current.year))
  }, [item.id, current.month, current.day, current.year])

  const parsed = parseISO(item.publishedAt)
  const suggestion = suggestedDate(item)

  const save = () => {
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (!isValidYmd(y, m, d)) {
      notify('日期不合法，请检查月份和天数', 'error')
      return
    }
    setManualDate(item.id, y, m, d)
    notify('日期已确认', 'success')
  }

  return (
    <div className={`date-editor${compact ? ' compact' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="field-label">日记日期</div>
        <span className={`badge ${current.confirmed ? 'badge-sage' : 'badge-warn'}`}>
          {current.confirmed ? '已确认' : '待校对'}
        </span>
      </div>
      <div className="date-inputs">
        <input
          className="input num"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-label="年"
        />
          <span className="faint">年</span>
        <input
          className="input num"
          value={month}
          onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label="月"
        />
        <span className="faint">月</span>
        <input
          className="input num"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label="日"
        />
        <span className="faint">日</span>
        <button className="btn btn-primary btn-sm" onClick={save}>
          确认
        </button>
      </div>
      <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmDate([item.id], 'published')}>
          沿用发布日 {formatMonthDay(parsed.month, parsed.day)}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmDate([item.id], 'suggested')}>
          采用推断 {formatMonthDay(suggestion.month, suggestion.day)}
        </button>
        {annotation?.date && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDateOverride(item.id, null)
              notify('已恢复为推断日期')
            }}
          >
            <Icon name="shuffle" size={12} />
            恢复推断
          </button>
        )}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
        发布日期 {item.publishedAt} · 手写日记通常比发布早一天，年份按发布年推断，可手动调整。
      </div>
    </div>
  )
}
