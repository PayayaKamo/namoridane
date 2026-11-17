import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Modal'
import { isValidYmd } from '../lib/dates'
import { originalUrl } from '../lib/image'
import { navigate } from '../lib/router'
import { downloadReviewJson, reviewStatusOf } from '../lib/review'
import { useStore } from '../state/store'
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
    notify('审核结果 JSON 已导出，原始图片未做任何改动', 'success')
  }

  return (
    <div className="diary-review-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Diary Review</div>
          <h2 className="page-title">绘日记审核</h2>
          <div className="page-sub">
            逐张人工确认类型和图内日期。有 OCR 候选时默认预填建议值，没有时回填「发布日 - 1 天」的推测值；以你的确认为准，且不修改任何原始图片。
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/review')}>
            <Icon name="calendar" size={14} />日期校对
          </button>
          <button className="btn btn-primary" onClick={exportReview}>
            <Icon name="download" size={14} />导出审核 JSON
          </button>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-head">
          <span>
            审核进度 · 已确认 {confirmedDiaryItems.length} 张绘日记，{excludedItems.length} 张非绘日记
          </span>
          <span className="num">
            {reviewedCount} / {allItems.length} · 剩余 {remainingCount}
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
              ['pending', `待确认 ${pendingReviewItems.length}`],
              ['diary', `是绘日记 ${confirmedDiaryItems.length}`],
              ['not_diary', `非绘日记 ${excludedItems.length}`],
              ['all', `全部 ${allItems.length}`],
            ] as [Queue, string][]
          ).map(([key, label]) => (
            <button key={key} className={queue === key ? 'active' : ''} onClick={() => chooseQueue(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="faint">待确认暂时保留在图库；确认非绘日记后才隐藏。</span>
      </div>

      {!current ? (
        <Empty
          icon="check"
          title={queue === 'pending' ? '待确认图片已经全部处理完' : '这个分组还没有图片'}
          hint={queue === 'pending' ? '可以切换到「是绘日记」复查，或导出审核 JSON 备份。' : '切换其他分组继续查看。'}
          action={queue === 'pending' ? <button className="btn" onClick={() => chooseQueue('diary')}>查看已确认</button> : undefined}
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
      notify('日记日期不合法，请检查年月日', 'error')
      return
    }
    setDateOverride(item.id, { year: y, month: m, day: d, confirmed: true, source })
    setReviewStatus([item.id], 'diary')
    notify('已确认为绘日记并保存日记日期', 'success')
    onAdvance()
  }

  const markNotDiary = () => {
    setReviewStatus([item.id], 'not_diary')
    notify('已标记为非绘日记；原图仍完整保留', 'success')
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
    notify('已移回待确认', 'success')
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
            {status === 'diary' ? '已确认绘日记' : status === 'not_diary' ? '已确认非绘日记' : '待确认'}
          </span>
          <span className="faint num">{index + 1} / {total}</span>
        </div>

        <div className="diary-review-file">
          <strong>{item.sourceFile ?? item.file}</strong>
          <span>原始文件名 · {item.sourceFile ? 'Instagram CDN' : '未记录'}</span>
          <span>导入后文件名 · {item.file}</span>
          <span>Shortcode · {item.shortcode}</span>
          <span>原图尺寸 · {item.w} × {item.h}</span>
          {item.postCount > 1 && <span>同帖图片 · 第 {item.postIndex + 1} / {item.postCount} 张</span>}
          <span className="faint">发布日期来自帖子元数据；文件名是导入时重命名的。</span>
        </div>

        {item.ocr?.candidates?.length ? (
          <div className="ocr-box">
            <div
              className="ocr-crop"
              style={{ backgroundImage: `url(${BASE}${item.large})` }}
              role="img"
              aria-label="左上角日期区域预览"
            />
            <div className="ocr-meta">
              <span className="badge badge-accent">Windows OCR 候选 · 仍需人工确认</span>
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
                <span className="faint">识别原文：{item.ocr.rawText.slice(0, 90)}</span>
              )}
            </div>
          </div>
        ) : null}

        <section className="diary-review-section">
          <div className="field-label">发布日期（导入时写入文件名）</div>
          <div className="diary-review-published num">{item.publishedAt || '未知（文件名没有日期）'}</div>
        </section>

        <section className="diary-review-section">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="field-label">图内日记日期</span>
            <span className="faint">
              {source === 'manual'
                ? '手动填写'
                : item.suggestedDiaryDate
                  ? 'OCR 建议（发布日就近推断年份），以你的确认为准'
                  : item.dateKnown
                    ? '推测（发布日 - 1 天），可直接改月 / 日'
                    : '日期未知，请手动填写'}
            </span>
          </div>
          <div className="diary-review-date-inputs">
            <input
              className="input num"
              value={year}
              placeholder="年"
              onChange={(e) => { setYear(e.target.value.replace(/\D/g, '').slice(0, 4)); setSource('manual') }}
              aria-label="日记年份"
            />
            <span>年</span>
            <input
              className="input num"
              value={month}
              placeholder="月"
              onChange={(e) => { setMonth(e.target.value.replace(/\D/g, '').slice(0, 2)); setSource('manual') }}
              aria-label="日记月份"
            />
            <span>月</span>
            <input
              className="input num"
              value={day}
              placeholder="日"
              onChange={(e) => { setDay(e.target.value.replace(/\D/g, '').slice(0, 2)); setSource('manual') }}
              aria-label="日记日"
            />
            <span>日</span>
          </div>
          <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={useInferredDate} disabled={!item.inferredMonth || !item.inferredDay}>
              {item.suggestedDiaryDate ? '填入 OCR 建议' : '填入推测日期'} {item.inferredMonth ? `${item.inferredMonth}/${item.inferredDay}` : '—'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={usePublishedDate} disabled={!item.publishedAt}>
              沿用发布日
            </button>
          </div>
        </section>

        <div className="diary-review-decisions">
          <button className="btn btn-primary btn-lg" onClick={confirmDiary}>
            <Icon name="check" size={16} />是绘日记，保存并下一张
          </button>
          <button className="btn btn-danger-ghost" onClick={markNotDiary}>
            <Icon name="close" size={15} />非绘日记
          </button>
          {status !== 'pending' && <button className="btn btn-ghost btn-sm" onClick={markPending}>移回待确认</button>}
        </div>

        <span className="faint">快捷键：Enter 确认 · N 非绘日记 · ← → 翻页</span>

        <a className="btn btn-ghost btn-sm" href={originalUrl(item)} target="_blank" rel="noreferrer">
          <Icon name="expand" size={13} />查看原始 JPG
        </a>

        <div className="diary-review-nav">
          <button className="btn btn-sm" onClick={onPrevious}><Icon name="left" size={13} />上一张</button>
          <button className="btn btn-sm" onClick={onNext}>下一张<Icon name="right" size={13} /></button>
        </div>
      </aside>
    </div>
  )
}
