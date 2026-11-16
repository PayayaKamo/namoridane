import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { effectiveDate, formatMonthDay, isValidYmd, publishedParts } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { openItem } from '../lib/router'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL

type ReviewFilter = 'pending' | 'rollover' | 'multi' | 'confirmed'

export function ReviewView() {
  const { items, annotations, confirmDate, setManualDate, getDate, notify } = useStore()
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
      notify('日期不合法', 'error')
      return
    }
    setManualDate(editing.id, y, m, d)
    notify('日期已确认', 'success')
    setEditing(null)
  }

  return (
    <div className="review-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Date Review</div>
          <h2 className="page-title">日期校对</h2>
          <div className="page-sub">
            手写日记只有月/日，默认按发布日前一天推断。核对大图上的日期后点确认。
          </div>
        </div>
        <div className="page-actions">
          <span className="badge badge-warn">待校对 {pending.length}</span>
          <span className="badge badge-sage">已确认 {confirmed.length}</span>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-head">
          <span>校对进度</span>
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
              ['pending', `待校对 ${pending.length}`],
              ['rollover', `跨月/跨年 ${pending.filter((i) => i.rollover).length}`],
              ['multi', `多图帖 ${pending.filter((i) => i.postCount > 1).length}`],
              ['confirmed', `已确认 ${confirmed.length}`],
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
            <span className="faint">已选 {selected.size}</span>
            <button
              className="btn btn-sm"
              onClick={() => {
                confirmDate(selectedIds, 'published')
                notify(`已将 ${selectedIds.length} 张标记为发布日`, 'success')
                setSelected(new Set())
              }}
            >
              按发布日确认
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                confirmDate(selectedIds, 'suggested')
                notify(`已将 ${selectedIds.length} 张按推断日确认`, 'success')
                setSelected(new Set())
              }}
            >
              按推断日确认
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
          title={filter === 'confirmed' ? '还没有已确认的日期' : '这一组已经全部校对完成'}
          hint="切换到其他分组继续，或到图库按日期浏览。"
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
                      <span className="badge">发布 {pub.month}/{pub.day}</span>
                      <span className={`badge ${d.confirmed ? 'badge-sage' : 'badge-accent'}`}>
                        推断 {formatMonthDay(item.inferredMonth, item.inferredDay)}
                      </span>
                      {item.rollover === 'year' && <span className="badge badge-warn">跨年</span>}
                      {item.rollover === 'month' && <span className="badge badge-warn">跨月</span>}
                      {item.postCount > 1 && <span className="badge">多图 {item.postIndex + 1}/{item.postCount}</span>}
                    </div>
                    <div className="review-date hand">
                      {d.year} · {d.month} / {d.day}
                    </div>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {d.source === 'published' ? '沿用发布日' : d.source === 'manual' ? '手动校对' : '按规律推断'}
                      {d.confirmed ? ' · 已确认' : ''}
                    </div>
                    <div className="review-actions">
                      {!d.confirmed && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              confirmDate([item.id], 'suggested')
                              notify('已按推断日确认', 'success')
                            }}
                          >
                            沿用推断
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              confirmDate([item.id], 'published')
                              notify('已按发布日确认', 'success')
                            }}
                          >
                            沿用发布
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => openEditor(item)}>
                        改月/日
                      </button>
                    </div>
                  </div>
                  <button
                    className={`select-check static${checked ? ' on' : ''}`}
                    onClick={() => toggle(item.id)}
                    aria-label="选择"
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
                加载更多（剩余 {list.length - limit}）
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal
          title="修改日记日期"
          subtitle={`${editing.file} · 发布 ${editing.publishedAt}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveEditor}>
                保存并确认
              </button>
            </>
          }
        >
          <div className="modal-preview">
            <img src={`${BASE}${editing.large}`} alt="" />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'center' }}>
            <input className="input num" style={{ width: 84 }} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <span className="faint">年</span>
            <input className="input num" style={{ width: 64 }} value={month} onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <span className="faint">月</span>
            <input className="input num" style={{ width: 64 }} value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <span className="faint">日</span>
          </div>
          <p className="faint" style={{ textAlign: 'center', marginTop: 8 }}>
            年份默认沿用发布年，跨年作品可在这里修正。
          </p>
        </Modal>
      )}
    </div>
  )
}
