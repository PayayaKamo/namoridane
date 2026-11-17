import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useStore } from '../state/store'
import { navigate, type Route } from '../lib/router'
import { effectiveDate, parseDateQuery, dayQueryOf } from '../lib/dates'
import { IS_PUBLIC } from '../lib/appMode'
import { restoreFilesFromTrash } from '../lib/trash'

const PUBLIC_PATHS = new Set(['/', '/calendar', '/gallery', '/storylines', '/reader', '/search', '/characters', '/stickers'])
const SIDEBAR_KEY = 'namori.sidebar.collapsed'

const PAGE_TITLES: Record<string, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'Overview', title: '概览' },
  calendar: { eyebrow: 'Calendar', title: '日历' },
  gallery: { eyebrow: 'Gallery', title: '图库' },
  reader: { eyebrow: 'Diary', title: '翻阅' },
  search: { eyebrow: 'Search', title: '搜索与筛选' },
  tags: { eyebrow: 'Tags', title: '标签' },
  characters: { eyebrow: 'Characters', title: '角色图鉴' },
  collections: { eyebrow: 'Collections', title: '合集' },
  collection: { eyebrow: 'Collections', title: '合集详情' },
  storylines: { eyebrow: 'Storyline', title: '故事线' },
  storyline: { eyebrow: 'Storyline', title: '故事线编辑' },
  datefind: { eyebrow: 'Date Lookup', title: '按日期查绘日记' },
  stickers: { eyebrow: 'Sticker Studio', title: '表情包工坊' },
  review: { eyebrow: 'Date Review', title: '日期校对' },
  'diary-review': { eyebrow: 'Diary Review', title: '绘日记审核' },
  stats: { eyebrow: 'Insights', title: '统计' },
  data: { eyebrow: 'Data', title: '数据与设置' },
  item: { eyebrow: 'Detail', title: '作品详情' },
}

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
  const searchRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState(route.query.get('q') ?? '')
  const [mobileOpen, setMobileOpen] = useState(false)
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
    notify(`已恢复 ${lastDeletion.length} 张`, 'success')
  }

  useEffect(() => setMobileOpen(false), [route])
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
      label: '浏览',
      items: [
        { path: '/', label: '概览', icon: 'home' },
        { path: '/calendar', label: '日历', icon: 'calendar' },
        { path: '/gallery', label: '图库', icon: 'gallery', count: items.length },
        { path: '/storylines', label: '故事线', icon: 'book' },
        { path: '/reader', label: '翻阅', icon: 'book' },
        { path: '/search', label: '搜索', icon: 'search' },
      ],
    },
    {
      label: '整理',
      items: [
        { path: '/tags', label: '标签', icon: 'tag', count: tags.length },
        { path: '/characters', label: '角色图鉴', icon: 'users' },
        { path: '/collections', label: '合集', icon: 'folder', count: collections.length },
        { path: '/stickers', label: '表情包', icon: 'sticker' },
        { path: '/diary-review', label: '绘日记审核', icon: 'checkSquare', count: pendingReviewItems.length },
        { path: '/review', label: '日期校对', icon: 'check', count: pendingCount },
      ],
    },
    {
      label: '工具',
      items: [
        { path: '/stats', label: '统计', icon: 'chart' },
        { path: '/data', label: '数据与设置', icon: 'database' },
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

  const meta = PAGE_TITLES[route.name] ?? PAGE_TITLES.home

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
        <button className="mobile-nav-backdrop" onClick={() => setMobileOpen(false)} aria-label="关闭导航菜单" />
      )}
      <aside id="site-navigation" className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="brand">
          <a className="brand-home" href="#/">
            <div className="brand-mark">绘</div>
            <div className="brand-text">
              <div className="brand-title">绘日记</div>
              <div className="brand-sub">Namori Diary</div>
            </div>
          </a>
          <button className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label="关闭导航菜单">
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
          <button
            className="nav-item sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-pressed={collapsed}
          >
            <Icon name={collapsed ? 'right' : 'left'} className="nav-icon" size={17} />
            <span className="nav-text">{collapsed ? '展开侧栏' : '收起侧栏'}</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-meta">
            <span>作品</span>
            <strong>{items.length}</strong>
          </div>
          {!IS_PUBLIC && (
            <div className="sidebar-meta">
              <span>待审核</span>
              <strong>{pendingReviewItems.length}</strong>
            </div>
          )}
          <button className="btn btn-soft btn-sm" onClick={toggleTheme} title="切换主题">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            <span>{theme === 'dark' ? '亮色主题' : '暗色主题'}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="打开全部功能菜单"
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="crumb">
            <span>绘日记</span>
            <Icon name="right" size={12} />
            <b>{meta.title}</b>
          </div>
          <div className="top-search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              value={term}
              placeholder="搜索标签、备注、日期…"
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
            />
            <kbd>/</kbd>
          </div>
          <button className="icon-btn mobile-search" onClick={() => navigate('/search')} aria-label="搜索与筛选">
            <Icon name="search" />
          </button>
          <button className="icon-btn" onClick={openRandom} title="随机抽一张" aria-label="随机抽一张">
            <Icon name="dice" />
          </button>
          <button
            className="icon-btn"
            onClick={() => notify('快捷键：← → 切换作品，Esc 关闭，/ 聚焦搜索，F 收藏，R 随机', 'default')}
            title="快捷键"
          >
            <Icon name="info" />
          </button>
        </header>
        <div className="content">{children}</div>
      </div>
      {!IS_PUBLIC && undoVisible && lastDeletion?.length ? (
        <div className="undo-bar" role="status">
          <span>已删除 {lastDeletion.length} 张，原图在回收站</span>
          <button className="btn btn-sm btn-primary" onClick={handleUndo}>
            <Icon name="check" size={13} />撤销
          </button>
          <button className="icon-btn" onClick={() => setUndoVisible(false)} aria-label="关闭">
            <Icon name="close" size={13} />
          </button>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="常用功能">
        {[
          { path: '/', label: '概览', icon: 'home' },
          { path: '/calendar', label: '日历', icon: 'calendar' },
          { path: '/gallery', label: '图库', icon: 'gallery' },
          { path: '/search', label: '搜索', icon: 'search' },
          { path: '/characters', label: '角色', icon: 'users' },
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
