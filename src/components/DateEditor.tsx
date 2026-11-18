import { useEffect, useState } from 'react'
import type { DiaryItem } from '../types'
import { useStore } from '../state/store'
import { formatMonthDay, isValidYmd, parseISO, suggestedDate } from '../lib/dates'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

export function DateEditor({ item, compact }: { item: DiaryItem; compact?: boolean }) {
  const { annotations, getDate, setManualDate, confirmDate, setDateOverride, notify } = useStore()
  const { t } = useI18n()
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
      notify(t('shell.dateEditor.invalid'), 'error')
      return
    }
    setManualDate(item.id, y, m, d)
    notify(t('shell.dateEditor.saved'), 'success')
  }

  return (
    <div className={`date-editor${compact ? ' compact' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="field-label">{t('shell.dateEditor.title')}</div>
        <span className={`badge ${current.confirmed ? 'badge-sage' : 'badge-warn'}`}>
          {current.confirmed ? t('shell.dateEditor.confirmed') : t('shell.dateEditor.pending')}
        </span>
      </div>
      <div className="date-inputs">
        <input
          className="input num"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-label={t('shell.dateEditor.year')}
        />
          <span className="faint">{t('shell.dateEditor.year')}</span>
        <input
          className="input num"
          value={month}
          onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label={t('shell.dateEditor.month')}
        />
        <span className="faint">{t('shell.dateEditor.month')}</span>
        <input
          className="input num"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
          aria-label={t('shell.dateEditor.day')}
        />
        <span className="faint">{t('shell.dateEditor.day')}</span>
        <button className="btn btn-primary btn-sm" onClick={save}>
          {t('shell.dateEditor.confirm')}
        </button>
      </div>
      <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmDate([item.id], 'published')}>
          {t('shell.dateEditor.usePublished', { date: formatMonthDay(parsed.month, parsed.day) })}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => confirmDate([item.id], 'suggested')}>
          {t('shell.dateEditor.useSuggested', { date: formatMonthDay(suggestion.month, suggestion.day) })}
        </button>
        {annotation?.date && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDateOverride(item.id, null)
              notify(t('shell.dateEditor.restored'))
            }}
          >
            <Icon name="shuffle" size={12} />
            {t('shell.dateEditor.restoreInferred')}
          </button>
        )}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
        {t('shell.dateEditor.hint', { date: item.publishedAt })}
      </div>
    </div>
  )
}
