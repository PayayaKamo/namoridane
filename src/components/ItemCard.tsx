import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiaryItem } from '../types'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { formatShortDate } from '../lib/dates'
import { openItem } from '../lib/router'
import { useI18n } from '../i18n'

const BASE = import.meta.env.BASE_URL

export function ItemCard({
  item,
  selectable,
  selected,
  onToggleSelect,
  showDate = true,
}: {
  item: DiaryItem
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  showDate?: boolean
}) {
  const { annotations, getDate, tagMap } = useStore()
  const { t } = useI18n()
  const [loaded, setLoaded] = useState(false)
  const annotation = annotations[item.id]
  const date = getDate(item)
  const itemTags = (annotation?.tags ?? []).map((id) => tagMap.get(id)).filter(Boolean)
  const hasNote = Boolean(annotation?.note || annotation?.study?.memo)

  return (
    <figure
      className={`item-card${selected ? ' selected' : ''}`}
      onClick={(e) => {
        if (selectable) {
          e.preventDefault()
          onToggleSelect?.(item.id)
        } else {
          openItem(item.id)
        }
      }}
    >
      <div
        className="item-media"
        style={{ aspectRatio: `${item.w || 1} / ${item.h || 1}`, background: item.color }}
      >
        {!loaded && <div className="skeleton item-skeleton" />}
        <img
          src={`${BASE}${item.thumb}`}
          alt={t('shell.card.imageAlt', { date: date.iso })}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
        {selectable && (
          <button
            className={`select-check${selected ? ' on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.(item.id)
            }}
            aria-label={selected ? t('common.deselect') : t('common.select')}
          >
            {selected && <Icon name="check" size={13} strokeWidth={2.4} />}
          </button>
        )}
        <div className="item-flags">
          {annotation?.favorite && (
            <span className="flag fav">
              <Icon name="heartFill" size={13} />
            </span>
          )}
          {hasNote && (
            <span className="flag">
              <Icon name="edit" size={12} />
            </span>
          )}
          {itemTags.length > 0 && (
            <span className="flag">
              <Icon name="tag" size={12} />
              {itemTags.length}
            </span>
          )}
        </div>
        {showDate && (
          <figcaption className="item-caption">
            <span className="hand">{date.month} / {date.day}</span>
            <span className="item-year">{date.year}</span>
            {!date.confirmed && <span className="dot-warn" title={t('shell.card.datePending')} />}
          </figcaption>
        )}
      </div>
      {itemTags.length > 0 && (
        <div className="item-tags">
          {itemTags.slice(0, 3).map((tag) => (
            <span key={tag!.id} className="tag-pill" style={{ ['--tag-color' as string]: tag!.color }}>
              {tag!.name}
            </span>
          ))}
          {itemTags.length > 3 && <span className="faint" style={{ fontSize: 10.5 }}>+{itemTags.length - 3}</span>}
        </div>
      )}
      <span className="sr-only">{formatShortDate(item.publishedAt)}</span>
    </figure>
  )
}

/** 逐步渲染，避免一次插入上千个节点 */
export function Masonry({
  items,
  selectable,
  selected,
  onToggleSelect,
  step = 80,
}: {
  items: DiaryItem[]
  selectable?: boolean
  selected?: Set<string>
  onToggleSelect?: (id: string) => void
  step?: number
}) {
  const [limit, setLimit] = useState(step)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLimit(step)
  }, [items, step])

  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    if (limit >= items.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((v) => Math.min(v + step * 2, items.length))
      },
      { rootMargin: '900px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [limit, items.length, step])

  const visible = useMemo(() => items.slice(0, limit), [items, limit])

  return (
    <>
      <div className="masonry">
        {visible.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            selectable={selectable}
            selected={selected?.has(item.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      {limit < items.length && <div ref={sentinel} style={{ height: 1 }} />}
    </>
  )
}
