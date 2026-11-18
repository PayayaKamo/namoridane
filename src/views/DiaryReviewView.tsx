import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Modal'
import { formatMonthDay, isValidYmd } from '../lib/dates'
import { originalUrl } from '../lib/image'
import { navigate } from '../lib/router'
import { downloadReviewJson, reviewStatusOf } from '../lib/review'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import type { DiaryItem, DiaryReviewStatus } from '../types'

const BASE = import.meta.env.BASE_URL
type Queue = DiaryReviewStatus | 'all'

export function DiaryReviewView() {
  const {
    allItems,
    annotations,
    confirmedDiaryItems,
    pendingReviewItems,
    excludedItems,
    notify,
  } = useStore()
  const { t } = useI18n()
  const [queue, setQueue] = useState<Queue>('pending')
  const [currentId, setCurrentId] = useState<string | null>(null)

  const list = useMemo(() => {
    const source =
      queue === 'pending'
        ? pendingReviewItems
        : queue === 'diary'
          ? confirmedDiaryItems
          : queue === 'not_diary'
            ? excludedItems
            : allItems
    const sorted = [...source]
    if (queue === 'pending') {
      // 按发布日期顺序处理，没有发布日期的排在最后，等待手动填写
      sorted.sort(
        (a, b) =>
          (a.publishedAt || '9999').localeCompare(b.publishedAt || '9999') ||
          a.postIndex - b.postIndex,
      )
    } else {
      sorted.sort((a, b) => (a.publishedAt || '9999').localeCompare(b.publishedAt || '9999') || a.postIndex - b.postIndex)
    }
    return sorted
  }, [queue, pendingReviewItems, confirmedDiaryItems, excludedItems, allItems])

  const current = (currentId && list.find((item) => item.id === currentId)) || list[0]
  const currentIndex = current ? list.findIndex((item) => item.id === current.id) : -1
  const reviewedCount = confirmedDiaryItems.length + excludedItems.length
  const remainingCount = Math.max(0, allItems.length - reviewedCount)

  const chooseQueue = (next: Queue) => {
    setQueue(next)
    setCurrentId(null)
  }

  const move = (offset: number) => {
    if (!current || list.length === 0) return
    const nextIndex = (currentIndex + offset + list.length) % list.length
    setCurrentId(list[nextIndex].id)
  }

  const advance = () => {
    if (!current) return
    setCurrentId(list[currentIndex + 1]?.id ?? null)
  }

  const exportReview = () => {
    downloadReviewJson(allItems, annotations)
    notify(t('adminData.review.exported'), 'success')
  }

  return (
    <div className="diary-review-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.diary-review.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.diary-review.title')}</h2>
          <div className="page-sub">
            {t('adminData.review.subtitle')}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/review')}>
            <Icon name="calendar" size={14} />{t('shell.nav.dateReview')}
          </button>
          <button className="btn btn-primary" onClick={exportReview}>
            <Icon name="download" size={14} />{t('adminData.review.export')}
          </button>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-head">
          <span>
            {t('adminData.review.progress', {
              confirmed: confirmedDiaryItems.length,
              excluded: excludedItems.length,
            })}
          </span>
          <span className="num">
            {reviewedCount} / {allItems.length} · {t('adminData.review.remaining', { count: remainingCount })}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${allItems.length ? (reviewedCount / allItems.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="review-toolbar">
        <div className="segmented">
          {(
            [
              ['pending', t('adminData.review.queue.pending', { count: pendingReviewItems.length })],
              ['diary', t('adminData.review.queue.diary', { count: confirmedDiaryItems.length })],
              ['not_diary', t('adminData.review.queue.notDiary', { count: excludedItems.length })],
              ['all', t('adminData.review.queue.all', { count: allItems.length })],
            ] as [Queue, string][]
          ).map(([key, label]) => (
            <button key={key} className={queue === key ? 'active' : ''} onClick={() => chooseQueue(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="faint">{t('adminData.review.queueHint')}</span>
      </div>

      {!current ? (
        <Empty
          icon="check"
          title={
            queue === 'pending'
              ? t('adminData.review.empty.pendingTitle')
              : t('adminData.review.empty.groupTitle')
          }
          hint={
            queue === 'pending'
              ? t('adminData.review.empty.pendingHint')
              : t('adminData.review.empty.groupHint')
          }
          action={queue === 'pending' ? <button className="btn" onClick={() => chooseQueue('diary')}>{t('adminData.review.empty.pendingAction')}</button> : undefined}
        />
      ) : (
        <ReviewStage
          key={current.id}
          item={current}
          index={currentIndex}
          total={list.length}
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
          onAdvance={advance}
        />
      )}
    </div>
  )
}

function ReviewStage({
  item,
  index,
  total,
  onPrevious,
  onNext,
  onAdvance,
}: {
  item: DiaryItem
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
  onAdvance: () => void
}) {
  const { annotations, getDate, setDateOverride, setReviewStatus, notify } = useStore()
  const { t } = useI18n()
  const date = getDate(item)
  const status = reviewStatusOf(annotations[item.id])
  const [year, setYear] = useState(date.year ? String(date.year) : '')
  const [month, setMonth] = useState(date.month ? String(date.month) : '')
  const [day, setDay] = useState(date.day ? String(date.day) : '')
  const [source, setSource] = useState(date.source)

  const usePublishedDate = () => {
    if (!item.publishedAt) return
    const [y, m, d] = item.publishedAt.split('-')
    setYear(y)
    setMonth(m)
    setDay(d)
    setSource('published')
  }

  const useInferredDate = () => {
    setYear(String(item.inferredYear))
    setMonth(String(item.inferredMonth))
    setDay(String(item.inferredDay))
    setSource('inferred')
  }

  const confirmDiary = () => {
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (!isValidYmd(y, m, d)) {
      notify(t('adminData.review.date.invalid'), 'error')
      return
    }
    setDateOverride(item.id, { year: y, month: m, day: d, confirmed: true, source })
    setReviewStatus([item.id], 'diary')
    notify(t('adminData.review.date.confirmed'), 'success')
    onAdvance()
  }

  const markNotDiary = () => {
    setReviewStatus([item.id], 'not_diary')
    notify(t('adminData.review.decisions.notDiaryDone'), 'success')
    onAdvance()
  }

  const adoptCandidate = (candidate: { year: number; month: number; day: number }) => {
    setYear(candidate.year ? String(candidate.year) : '')
    setMonth(String(candidate.month))
    setDay(String(candidate.day))
    setSource('manual')
  }

  const markPending = () => {
    setReviewStatus([item.id], 'pending')
    notify(t('adminData.review.decisions.pendingDone'), 'success')
    onAdvance()
  }

  // 键盘流：← → 翻页，Enter 确认是绘日记，N 标记非绘日记
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        Boolean(target) &&
        (target!.tagName === 'INPUT' || target!.tagName === 'TEXTAREA' || target!.isContentEditable)
      if (typing) {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirmDiary()
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        confirmDiary()
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        markNotDiary()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="diary-review-stage">
      <div className="diary-review-media">
        <img src={`${BASE}${item.large}`} alt={item.file} />
      </div>
      <aside className="diary-review-side">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className={`badge ${status === 'diary' ? 'badge-sage' : status === 'not_diary' ? 'badge-warn' : 'badge-accent'}`}>
            {status === 'diary'
              ? t('adminData.review.status.diary')
              : status === 'not_diary'
                ? t('adminData.review.status.notDiary')
                : t('adminData.review.status.pending')}
          </span>
          <span className="faint num">{index + 1} / {total}</span>
        </div>

        <div className="diary-review-file">
          <strong>{item.sourceFile ?? item.file}</strong>
          <span>
            {t('adminData.review.file.originalName', {
              value: item.sourceFile
                ? t('adminData.review.file.cdn')
                : t('adminData.review.file.notRecorded'),
            })}
          </span>
          <span>{t('adminData.review.file.importName', { file: item.file })}</span>
          <span>{t('adminData.review.file.shortcode', { code: item.shortcode })}</span>
          <span>{t('adminData.review.file.dimensions', { width: item.w, height: item.h })}</span>
          {item.postCount > 1 && (
            <span>
              {t('adminData.review.file.multiPost', {
                index: item.postIndex + 1,
                count: item.postCount,
              })}
            </span>
          )}
          <span className="faint">{t('adminData.review.file.note')}</span>
        </div>

        {item.ocr?.candidates?.length ? (
          <div className="ocr-box">
            <div
              className="ocr-crop"
              style={{ backgroundImage: `url(${BASE}${item.large})` }}
              role="img"
              aria-label={t('adminData.review.ocr.preview')}
            />
            <div className="ocr-meta">
              <span className="badge badge-accent">{t('adminData.review.ocr.badge')}</span>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {item.ocr.candidates.map((candidate) => (
                  <button
                    key={`${candidate.dateText}-${candidate.month}-${candidate.day}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => adoptCandidate(candidate)}
                  >
                    {candidate.month}/{candidate.day} · {Math.round(candidate.confidence * 100)}%
                  </button>
                ))}
              </div>
              {item.ocr.rawText && (
                <span className="faint">
                  {t('adminData.review.ocr.raw', { text: item.ocr.rawText.slice(0, 90) })}
                </span>
              )}
            </div>
          </div>
        ) : null}

        <section className="diary-review-section">
          <div className="field-label">{t('adminData.review.published.label')}</div>
          <div className="diary-review-published num">{item.publishedAt || t('adminData.review.published.unknown')}</div>
        </section>

        <section className="diary-review-section">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="field-label">{t('adminData.review.date.label')}</span>
            <span className="faint">
              {source === 'manual'
                ? t('adminData.review.date.manual')
                : item.suggestedDiaryDate
                  ? t('adminData.review.date.suggested')
                  : item.dateKnown
                    ? t('adminData.review.date.inferred')
                    : t('adminData.review.date.unknown')}
            </span>
          </div>
          <div className="diary-review-date-inputs">
            <input
              className="input num"
              value={year}
              placeholder={t('common.year')}
              onChange={(e) => { setYear(e.target.value.replace(/\D/g, '').slice(0, 4)); setSource('manual') }}
              aria-label={t('adminData.review.date.yearAria')}
            />
            <span>{t('common.year')}</span>
            <input
              className="input num"
              value={month}
              placeholder={t('common.month')}
              onChange={(e) => { setMonth(e.target.value.replace(/\D/g, '').slice(0, 2)); setSource('manual') }}
              aria-label={t('adminData.review.date.monthAria')}
            />
            <span>{t('common.month')}</span>
            <input
              className="input num"
              value={day}
              placeholder={t('common.day')}
              onChange={(e) => { setDay(e.target.value.replace(/\D/g, '').slice(0, 2)); setSource('manual') }}
              aria-label={t('adminData.review.date.dayAria')}
            />
            <span>{t('common.day')}</span>
          </div>
          <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={useInferredDate} disabled={!item.inferredMonth || !item.inferredDay}>
              {t(
                item.suggestedDiaryDate
                  ? 'adminData.review.date.fillOcr'
                  : 'adminData.review.date.fillInferred',
                {
                  date: item.inferredMonth
                    ? formatMonthDay(item.inferredMonth, item.inferredDay)
                    : '—',
                },
              )}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={usePublishedDate} disabled={!item.publishedAt}>
              {t('adminData.review.date.usePublished')}
            </button>
          </div>
        </section>

        <div className="diary-review-decisions">
          <button className="btn btn-primary btn-lg" onClick={confirmDiary}>
            <Icon name="check" size={16} />{t('adminData.review.decisions.confirm')}
          </button>
          <button className="btn btn-danger-ghost" onClick={markNotDiary}>
            <Icon name="close" size={15} />{t('adminData.review.decisions.notDiary')}
          </button>
          {status !== 'pending' && <button className="btn btn-ghost btn-sm" onClick={markPending}>{t('adminData.review.decisions.pending')}</button>}
        </div>

        <span className="faint">{t('adminData.review.decisions.shortcuts')}</span>

        <a className="btn btn-ghost btn-sm" href={originalUrl(item)} target="_blank" rel="noreferrer">
          <Icon name="expand" size={13} />{t('adminData.review.decisions.viewOriginal')}
        </a>

        <div className="diary-review-nav">
          <button className="btn btn-sm" onClick={onPrevious}><Icon name="left" size={13} />{t('common.previous')}</button>
          <button className="btn btn-sm" onClick={onNext}>{t('common.next')}<Icon name="right" size={13} /></button>
        </div>
      </aside>
    </div>
  )
}
