import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { LocaleSwitch } from './LocaleSwitch'
import { useStore } from '../state/store'
import { navigate, type Route } from '../lib/router'
import { effectiveDate, parseDateQuery, dayQueryOf } from '../lib/dates'
import { IS_PUBLIC } from '../lib/appMode'
import { restoreFilesFromTrash } from '../lib/trash'
import { useI18n, type MessageKey } from '../i18n'

const PUBLIC_PATHS = new Set(['/', '/calendar', '/gallery', '/storylines', '/reader', '/search', '/characters', '/stats'])
const SIDEBAR_KEY = 'namori.sidebar.collapsed'

interface NavEntry {
  path: string
  label: string
  icon: string
  count?: number
  badge?: boolean
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const {
    items,
    itemMap,
    pendingReviewItems,
    annotations,
    tags,
    collections,
    theme,
    toggleTheme,
    lastDeletion,
    undoDelete,
    notify,
  } = useStore()
  const { t } = useI18n()
  const searchRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState(route.query.get('q') ?? '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [undoVisible, setUndoVisible] = useState(false)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (!lastDeletion?.length) {
      setUndoVisible(false)
      return
    }
    setUndoVisible(true)
    const timer = window.setTimeout(() => setUndoVisible(false), 10000)
    return () => window.clearTimeout(timer)
  }, [lastDeletion])

  const handleUndo = async () => {
    if (!lastDeletion?.length) return
    const files = lastDeletion.flatMap((id) => {
      const item = itemMap.get(id)
      return item ? [item.file] : []
    })
    await restoreFilesFromTrash(files)
    undoDelete()
    notify(t('shell.undo.restored', { count: lastDeletion.length }), 'success')
  }

  useEffect(() => setMobileOpen(false), [route])
  useEffect(() => setSearchOpen(false), [route])

  // 移动端搜索展开时：点空白、Esc 或向下滚动都收起
  useEffect(() => {
    if (!searchOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (mobileSearchRef.current?.contains(event.target as Node)) return
      setSearchOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false)
    }
    const onScroll = () => setSearchOpen(false)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [searchOpen])
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const pendingCount = useMemo(
    () => items.filter((item) => !effectiveDate(item, annotations[item.id]).confirmed).length,
    [items, annotations],
  )

  const groups: { label: string; items: NavEntry[] }[] = [
    {
      label: t('shell.nav.browse'),
      items: [
        { path: '/', label: t('shell.nav.home'), icon: 'home' },
        { path: '/calendar', label: t('shell.nav.calendar'), icon: 'calendar' },
        { path: '/gallery', label: t('shell.nav.gallery'), icon: 'gallery', count: items.length },
        { path: '/storylines', label: t('shell.nav.storylines'), icon: 'book' },
        { path: '/reader', label: t('shell.nav.reader'), icon: 'book' },
        { path: '/search', label: t('shell.nav.search'), icon: 'search' },
        ...(IS_PUBLIC ? [{ path: '/stats', label: t('shell.nav.stats'), icon: 'chart' }] : []),
      ],
    },
    {
      label: t('shell.nav.organize'),
      items: [
        { path: '/tags', label: t('shell.nav.tags'), icon: 'tag', count: tags.length },
        { path: '/characters', label: t('shell.nav.characters'), icon: 'users' },
        { path: '/character-tagging', label: t('shell.nav.characterTagging'), icon: 'eye' },
        { path: '/collections', label: t('shell.nav.collections'), icon: 'folder', count: collections.length },
        { path: '/diary-review', label: t('shell.nav.diaryReview'), icon: 'checkSquare', count: pendingReviewItems.length },
        { path: '/review', label: t('shell.nav.dateReview'), icon: 'check', count: pendingCount },
      ],
    },
    {
      label: t('shell.nav.tools'),
      items: [
        ...(IS_PUBLIC ? [] : [{ path: '/stats', label: t('shell.nav.stats'), icon: 'chart' }]),
        { path: '/data', label: t('shell.nav.data'), icon: 'database' },
      ],
    },
  ]

  const visibleGroups = IS_PUBLIC
    ? groups
        .map((group) => ({ ...group, items: group.items.filter((entry) => PUBLIC_PATHS.has(entry.path)) }))
        .filter((group) => group.items.length > 0)
    : groups

  const activePath =
    route.name === 'collection'
      ? '/collections'
      : route.name === 'storyline'
        ? '/storylines'
        : route.name === 'item'
          ? ''
          : route.name === 'home'
            ? '/'
            : `/${route.name}`

  const meta = {
    eyebrow: t(`shell.page.${route.name}.eyebrow` as MessageKey),
    title: t(`shell.page.${route.name}.title` as MessageKey),
  }

  const submitSearch = () => {
    const q = term.trim()
    const dateQuery = parseDateQuery(q)
    if (dateQuery) {
      navigate(`/datefind?md=${dayQueryOf(dateQuery)}${dateQuery.year ? `&y=${dateQuery.year}` : ''}`)
      return
    }
    navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  const openRandom = () => {
    if (!items.length) return
    const pick = items[Math.floor(Math.random() * items.length)]
    navigate(`/item/${pick.id}`)
  }

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      {mobileOpen && (
        <button className="mobile-nav-backdrop" onClick={() => setMobileOpen(false)} aria-label={t('shell.aria.closeNav')} />
      )}
      <aside id="site-navigation" className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="brand">
          <a className="brand-home" href="#/">
            <div className="brand-mark">
              <img src={`${import.meta.env.BASE_URL}namori_icon.webp`} alt="" />
            </div>
            <div className="brand-text">
              <div className="brand-title">{t('shell.siteName')}</div>
              <div className="brand-sub">{t('shell.brandSub')}</div>
            </div>
          </a>
          <button className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label={t('shell.aria.closeNav')}>
            <Icon name="close" />
          </button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((entry) => (
                <a
                  key={entry.path}
                  href={`#${entry.path}`}
                  className={`nav-item${activePath === entry.path ? ' active' : ''}`}
                  title={entry.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name={entry.icon} className="nav-icon" size={17} />
                  <span className="nav-text">{entry.label}</span>
                  {typeof entry.count === 'number' && entry.count > 0 && (
                    <span className="nav-badge">{entry.count > 999 ? `${Math.floor(entry.count / 100) / 10}k` : entry.count}</span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-toggle-bar">
          <button
            className="nav-item sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
            aria-label={collapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
            aria-pressed={collapsed}
          >
            <Icon name={collapsed ? 'right' : 'left'} className="nav-icon" size={17} />
            <span className="nav-text">{collapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}</span>
          </button>
        </div>
        <div className="sidebar-foot">
          <div className="sidebar-meta">
            <span>{t('shell.nav.works')}</span>
            <strong>{items.length}</strong>
          </div>
          {!IS_PUBLIC && (
            <div className="sidebar-meta">
              <span>{t('shell.nav.pendingReview')}</span>
              <strong>{pendingReviewItems.length}</strong>
            </div>
          )}
          <LocaleSwitch />
          <button className="btn btn-soft btn-sm" onClick={toggleTheme} title={t('shell.theme.toggle')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            <span>{theme === 'dark' ? t('shell.theme.switchToLight') : t('shell.theme.switchToDark')}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label={t('shell.aria.openNav')}
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="crumb">
            <span>{t('shell.siteName')}</span>
            <Icon name="right" size={12} />
            <b>{meta.title}</b>
          </div>
          <div className="top-search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              value={term}
              placeholder={t('shell.search.placeholder')}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
            />
            <kbd>/</kbd>
          </div>
          <button
            className="icon-btn mobile-search"
            onClick={() => setSearchOpen(true)}
            aria-label={t('shell.aria.openSearch')}
            aria-expanded={searchOpen}
          >
            <Icon name="search" />
          </button>
          {searchOpen && (
            <div className="mobile-search-bar" ref={mobileSearchRef} role="search">
              <Icon name="search" size={16} />
              <input
                autoFocus
                value={term}
                placeholder={t('shell.search.placeholder')}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitSearch()
                    setSearchOpen(false)
                  }
                }}
              />
              <button className="icon-btn" onClick={() => setSearchOpen(false)} aria-label={t('shell.aria.closeSearch')}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <button className="icon-btn" onClick={openRandom} title={t('shell.random')} aria-label={t('shell.random')}>
            <Icon name="dice" />
          </button>
          <LocaleSwitch variant="compact" />
          <button
            className="icon-btn"
            onClick={() => notify(t('shell.search.shortcutTip'), 'default')}
            title={t('shell.shortcuts.title')}
            aria-label={t('shell.aria.shortcuts')}
          >
            <Icon name="info" />
          </button>
        </header>
        <div className="content" role="main">
          {route.name !== 'home' && (
            <h1 className="sr-only">
              {t('shell.siteName')} · {t('shell.brandSub')} · {meta.title}
            </h1>
          )}

          {children}
          <footer className="site-footer">
            <span className="site-footer-copy">{t('shell.footerCopy')}</span>
            <a className="site-footer-link" href="https://github.com/payayakamo" target="_blank" rel="noopener noreferrer">
              {t('shell.footer.githubProfile')}
              <Icon name="share" size={12} />
            </a>
            <a
              className="site-footer-link"
              href="https://github.com/PayayaKamo/namoridane"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('shell.footer.repository')}
              <Icon name="share" size={12} />
            </a>
            <a className="site-footer-link" href="https://xhslink.cn/o/AmThiRAG07o" target="_blank" rel="noopener noreferrer">
              {t('shell.footer.xiaohongshu')}
              <Icon name="share" size={12} />
            </a>
            <a className="site-footer-link" href="https://xhslink.cn/o/22fet2ONRIv" target="_blank" rel="noopener noreferrer">
              {t('shell.footer.xiaohongshuAlt')}
              <Icon name="share" size={12} />
            </a>
          </footer>
        </div>
      </div>
      {!IS_PUBLIC && undoVisible && lastDeletion?.length ? (
        <div className="undo-bar" role="status">
          <span>{t('shell.undo.deleted', { count: lastDeletion.length })}</span>
          <button className="btn btn-sm btn-primary" onClick={handleUndo}>
            <Icon name="check" size={13} />
            {t('shell.undo.action')}
          </button>
          <button className="icon-btn" onClick={() => setUndoVisible(false)} aria-label={t('shell.aria.close')}>
            <Icon name="close" size={13} />
          </button>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label={t('shell.nav.mobileLabel')}>
        {[
          { path: '/', label: t('shell.nav.home'), icon: 'home' },
          { path: '/calendar', label: t('shell.nav.calendar'), icon: 'calendar' },
          { path: '/gallery', label: t('shell.nav.gallery'), icon: 'gallery' },
          { path: '/search', label: t('shell.nav.search'), icon: 'search' },
          { path: '/characters', label: t('shell.nav.characters'), icon: 'users' },
        ].map((entry) => (
          <a
            key={entry.path}
            href={`#${entry.path}`}
            className={activePath === entry.path ? 'active' : ''}
            aria-current={activePath === entry.path ? 'page' : undefined}
          >
            <Icon name={entry.icon} size={19} />
            <span>{entry.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
