import { useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { formatFullDate, weekdayLabel } from '../lib/dates'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'

const BASE = import.meta.env.BASE_URL
const SCOPE_KEY = 'namori.reader.scope'

type Scope = 'all' | 'diary'

const dateValue = (iso: string) => {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

export function ReaderView({ route }: { route: Route }) {
  const { items, confirmedDiaryItems, getDate, annotations, toggleFavorite, notify } = useStore()
  const { t } = useI18n()
  const [scope, setScope] = useState<Scope>(() => (localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'diary'))
  const ordered = useMemo(() => {
    const pool = scope === 'diary' ? confirmedDiaryItems : items
    return [...pool].sort((a, b) => getDate(a).iso.localeCompare(getDate(b).iso) || a.postIndex - b.postIndex)
  }, [scope, items, confirmedDiaryItems, getDate])
  const startId = route.query.get('start')
  const [index, setIndex] = useState(() => {
    const startItem = startId ? items.find((i) => i.id === startId) : undefined
    if (!startItem) return 0
    const found = ordered.findIndex((i) => i.id === startId)
    if (found >= 0) return found
    // 指定条目不在当前范围（例如默认只看绘日记）时，定位到日期最近的一条
    const target = dateValue(getDate(startItem).iso)
    let best = 0
    let bestDistance = Infinity
    ordered.forEach((entry, position) => {
      const distance = Math.abs(dateValue(getDate(entry).iso) - target)
      if (distance < bestDistance) {
        bestDistance = distance
        best = position
      }
    })
    return best
  })
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [chrome, setChrome] = useState(true)
  const shellRef = useRef<HTMLDivElement>(null)

  const item = ordered[index]
  const date = item ? getDate(item) : null
  const ann = item ? annotations[item.id] : undefined

  useEffect(() => {
    if (ordered[index + 1]) {
      const img = new Image()
      img.src = `${BASE}${ordered[index + 1].large}`
    }
  }, [index, ordered])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(ordered.length - 1, i + 1))
      } else if (e.key.toLowerCase() === 'f' && item) {
        toggleFavorite([item.id])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered.length, item, toggleFavorite])

  // 鼠标静止 3 秒后淡出控制条
  useEffect(() => {
    let timer = window.setTimeout(() => setChrome(false), 3200)
    const onMove = () => {
      setChrome(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setChrome(false), 3200)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  if (!item || !date) {
    return (
      <div className="reader-empty">
        <p>{IS_PUBLIC ? t('browse.reader.emptyPublic') : t('browse.reader.empty')}</p>
        <button className="btn" onClick={() => navigate(IS_PUBLIC ? '/' : '/gallery')}>
          {IS_PUBLIC ? t('browse.reader.backHome') : t('browse.reader.goGallery')}
        </button>
      </div>
    )
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shellRef.current?.requestFullscreen()
    } catch {
      notify(t('browse.reader.fullscreenUnsupported'), 'default')
    }
  }

  // 切换范围时保留当前作品；若被过滤掉，则定位到日期最近的可用作品
  const switchScope = (next: Scope) => {
    if (next === scope) return
    localStorage.setItem(SCOPE_KEY, next)
    const current = ordered[index]
    const pool = next === 'diary' ? confirmedDiaryItems : items
    const nextOrdered = [...pool].sort(
      (a, b) => getDate(a).iso.localeCompare(getDate(b).iso) || a.postIndex - b.postIndex,
    )
    let nextIndex = 0
    if (current) {
      const found = nextOrdered.findIndex((entry) => entry.id === current.id)
      if (found >= 0) {
        nextIndex = found
      } else {
        const target = dateValue(getDate(current).iso)
        let bestDist = Infinity
        nextOrdered.forEach((entry, position) => {
          const dist = Math.abs(dateValue(getDate(entry).iso) - target)
          if (dist < bestDist) {
            bestDist = dist
            nextIndex = position
          }
        })
      }
    }
    setIndex(nextIndex)
    setScope(next)
  }

  const loaded = loadedId === item.id

  return (
    <div className={`reader${chrome ? '' : ' chrome-hidden'}`} ref={shellRef}>
      <div className="reader-chrome reader-top">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/gallery')}>
          <Icon name="close" size={14} />
          {t('browse.reader.exit')}
        </button>
        <div className="reader-progress">
          <div className="reader-progress-fill" style={{ width: `${((index + 1) / ordered.length) * 100}%` }} />
        </div>
        <div className="reader-scope" role="tablist" aria-label={t('browse.reader.scopeAria')}>
          <button
            className={scope === 'all' ? 'active' : ''}
            onClick={() => switchScope('all')}
            role="tab"
            aria-selected={scope === 'all'}
          >
            {t('common.all')}
          </button>
          <button
            className={scope === 'diary' ? 'active' : ''}
            onClick={() => switchScope('diary')}
            role="tab"
            aria-selected={scope === 'diary'}
          >
            {t('browse.reader.scopeDiary')}
          </button>
        </div>
        <span className="num reader-count">
          {index + 1} / {ordered.length}
        </span>
        <button className="icon-btn" onClick={() => toggleFavorite([item.id])} title={t('browse.reader.favorite')}>
          <Icon name={ann?.favorite ? 'heartFill' : 'heart'} size={17} />
        </button>
        <button className="icon-btn" onClick={toggleFullscreen} title={t('browse.reader.fullscreen')}>
          <Icon name="expand" size={17} />
        </button>
      </div>

      <button
        className="reader-nav left"
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
        disabled={index === 0}
        aria-label={t('browse.reader.prevPage')}
      >
        <Icon name="left" size={22} />
      </button>

      <div className="reader-page">
        <div className="reader-frame" style={{ background: item.color }}>
          {!loaded && <div className="skeleton media-skeleton" />}
          <img
            key={item.id}
            src={`${BASE}${item.large}`}
            alt={t('browse.reader.imageAlt', { date: date.iso })}
            onLoad={() => setLoadedId(item.id)}
            style={{ opacity: loaded ? 1 : 0 }}
            loading="eager"
          />
        </div>
      </div>

      <button
        className="reader-nav right"
        onClick={() => setIndex((i) => Math.min(ordered.length - 1, i + 1))}
        disabled={index === ordered.length - 1}
        aria-label={t('browse.reader.nextPage')}
      >
        <Icon name="right" size={22} />
      </button>

      <div className="reader-chrome reader-bottom">
        <div className="reader-date">
          <span className="hand">{t('common.monthDay', { month: date.month, day: date.day })}</span>
          <span className="num">{date.year}</span>
          <span className="faint">
            {weekdayLabel(date.iso)} · {t('browse.reader.published', { date: formatFullDate(item.publishedAt) })}
          </span>
        </div>
        <div className="reader-hint faint">{t('browse.reader.hint')}</div>
      </div>
    </div>
  )
}
