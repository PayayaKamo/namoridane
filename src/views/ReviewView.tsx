import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { effectiveDate, formatMonthDay, isValidYmd, publishedParts } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { openItem } from '../lib/router'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL

type ReviewFilter = 'pending' | 'rollover' | 'multi' | 'confirmed'

export function ReviewView() {
  const { items, annotations, confirmDate, setManualDate, getDate, notify } = useStore()
  const { t } = useI18n()
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(36)
  const [editing, setEditing] = useState<DiaryItem | null>(null)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')

  const pending = useMemo(
    () => items.filter((item) => !effectiveDate(item, annotations[item.id]).confirmed),
    [items, annotations],
  )
  const confirmed = useMemo(
    () => items.filter((item) => effectiveDate(item, annotations[item.id]).confirmed),
    [items, annotations],
  )

  const list = useMemo(() => {
    let base = filter === 'confirmed' ? confirmed : pending
    if (filter === 'rollover') base = pending.filter((i) => i.rollover !== '')
    if (filter === 'multi') base = pending.filter((i) => i.postCount > 1)
    return [...base].sort((a, b) => {
      const rank = (x: DiaryItem) => (x.rollover === 'year' ? 3 : x.rollover === 'month' ? 2 : x.postCount > 1 ? 1 : 0)
      return rank(b) - rank(a) || b.publishedAt.localeCompare(a.publishedAt) || a.postIndex - b.postIndex
    })
  }, [filter, pending, confirmed])

  const visible = list.slice(0, limit)
  const selectedIds = [...selected]

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openEditor = (item: DiaryItem) => {
    const d = getDate(item)
    setEditing(item)
    setYear(String(d.year))
    setMonth(String(d.month))
    setDay(String(d.day))
  }

  const saveEditor = () => {
    if (!editing) return
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (!isValidYmd(y, m, d)) {
      notify(t('adminOrg.review.editor.invalid'), 'error')
      return
    }
    setManualDate(editing.id, y, m, d)
    notify(t('shell.dateEditor.saved'), 'success')
    setEditing(null)
  }

  return (
    <div className="review-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('adminOrg.review.eyebrow')}</div>
          <h2 className="page-title">{t('adminOrg.review.title')}</h2>
          <div className="page-sub">
            {t('adminOrg.review.subtitle')}
          </div>
        </div>
        <div className="page-actions">
          <span className="badge badge-warn">
            {t('adminOrg.review.pendingCount', { count: pending.length })}
          </span>
          <span className="badge badge-sage">
            {t('adminOrg.review.confirmedCount', { count: confirmed.length })}
          </span>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-head">
          <span>{t('adminOrg.review.progress')}</span>
          <span className="num">
            {confirmed.length} / {items.length}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${items.length ? (confirmed.length / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="review-toolbar">
        <div className="segmented">
          {(
            [
              ['pending', t('adminOrg.review.pendingCount', { count: pending.length })],
              [
                'rollover',
                t('adminOrg.review.filter.rollover', { count: pending.filter((i) => i.rollover).length }),
              ],
              ['multi', t('adminOrg.review.filter.multi', { count: pending.filter((i) => i.postCount > 1).length })],
              ['confirmed', t('adminOrg.review.confirmedCount', { count: confirmed.length })],
            ] as [ReviewFilter, string][]
          ).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => { setFilter(key); setLimit(36) }}>
              {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {selected.size > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <span className="faint">{t('adminOrg.review.selected', { count: selected.size })}</span>
            <button
              className="btn btn-sm"
              onClick={() => {
                confirmDate(selectedIds, 'published')
                notify(t('adminOrg.review.bulk.publishedDone', { count: selectedIds.length }), 'success')
                setSelected(new Set())
              }}
            >
              {t('adminOrg.review.bulk.published')}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                confirmDate(selectedIds, 'suggested')
                notify(t('adminOrg.review.bulk.suggestedDone', { count: selectedIds.length }), 'success')
                setSelected(new Set())
              }}
            >
              {t('adminOrg.review.bulk.suggested')}
            </button>
            <button className="icon-btn" onClick={() => setSelected(new Set())}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Empty
          icon="check"
          title={
            filter === 'confirmed'
              ? t('adminOrg.review.empty.confirmedTitle')
              : t('adminOrg.review.empty.doneTitle')
          }
          hint={t('adminOrg.review.empty.hint')}
        />
      ) : (
        <>
          <div className="review-grid">
            {visible.map((item) => {
              const d = getDate(item)
              const pub = publishedParts(item)
              const checked = selected.has(item.id)
              return (
                <div key={item.id} className={`review-card${checked ? ' selected' : ''}`}>
                  <button className="review-thumb" onClick={() => openItem(item.id)}>
                    <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" />
                  </button>
                  <div className="review-info">
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge">
                        {t('adminOrg.review.card.published', { month: pub.month, day: pub.day })}
                      </span>
                      <span className={`badge ${d.confirmed ? 'badge-sage' : 'badge-accent'}`}>
                        {t('adminOrg.review.card.inferred', {
                          date: formatMonthDay(item.inferredMonth, item.inferredDay),
                        })}
                      </span>
                      {item.rollover === 'year' && (
                        <span className="badge badge-warn">{t('adminOrg.review.card.rolloverYear')}</span>
                      )}
                      {item.rollover === 'month' && (
                        <span className="badge badge-warn">{t('adminOrg.review.card.rolloverMonth')}</span>
                      )}
                      {item.postCount > 1 && (
                        <span className="badge">
                          {t('adminOrg.review.card.multi', { index: item.postIndex + 1, count: item.postCount })}
                        </span>
                      )}
                    </div>
                    <div className="review-date hand">
                      {d.year} · {d.month} / {d.day}
                    </div>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {d.source === 'published'
                        ? t('adminOrg.review.card.sourcePublished')
                        : d.source === 'manual'
                          ? t('adminOrg.review.card.sourceManual')
                          : t('adminOrg.review.card.sourceInferred')}
                      {d.confirmed ? t('adminOrg.review.card.confirmedSuffix') : ''}
                    </div>
                    <div className="review-actions">
                      {!d.confirmed && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              confirmDate([item.id], 'suggested')
                              notify(t('adminOrg.review.card.suggestedDone'), 'success')
                            }}
                          >
                            {t('adminOrg.review.card.useSuggested')}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              confirmDate([item.id], 'published')
                              notify(t('adminOrg.review.card.publishedDone'), 'success')
                            }}
                          >
                            {t('adminOrg.review.card.usePublished')}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => openEditor(item)}>
                        {t('adminOrg.review.card.editDate')}
                      </button>
                    </div>
                  </div>
                  <button
                    className={`select-check static${checked ? ' on' : ''}`}
                    onClick={() => toggle(item.id)}
                    aria-label={t('common.select')}
                  >
                    {checked && <Icon name="check" size={13} strokeWidth={2.4} />}
                  </button>
                </div>
              )
            })}
          </div>
          {limit < list.length && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <button className="btn" onClick={() => setLimit((v) => v + 36)}>
                {t('adminOrg.review.loadMore', { count: list.length - limit })}
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal
          title={t('adminOrg.review.editor.title')}
          subtitle={t('adminOrg.review.editor.subtitle', {
            file: editing.file,
            date: editing.publishedAt,
          })}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={saveEditor}>
                {t('adminOrg.review.editor.saveAndConfirm')}
              </button>
            </>
          }
        >
          <div className="modal-preview">
            <img src={`${BASE}${editing.large}`} alt="" />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'center' }}>
            <input className="input num" style={{ width: 84 }} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <span className="faint">{t('common.year')}</span>
            <input className="input num" style={{ width: 64 }} value={month} onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <span className="faint">{t('common.month')}</span>
            <input className="input num" style={{ width: 64 }} value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <span className="faint">{t('common.day')}</span>
          </div>
          <p className="faint" style={{ textAlign: 'center', marginTop: 8 }}>
            {t('adminOrg.review.editor.hint')}
          </p>
        </Modal>
      )}
    </div>
  )
}
