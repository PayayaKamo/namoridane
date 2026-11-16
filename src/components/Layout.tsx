import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useStore } from '../state/store'
import { navigate, type Route } from '../lib/router'
import { effectiveDate } from '../lib/dates'

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
  stickers: { eyebrow: 'Sticker Studio', title: '表情包工坊' },
  review: { eyebrow: 'Date Review', title: '日期校对' },
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
  const { items, annotations, tags, collections, theme, toggleTheme, notify } = useStore()
  const searchRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState(route.query.get('q') ?? '')

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

  const activePath =
    route.name === 'collection'
      ? '/collections'
      : route.name === 'item'
        ? ''
        : route.name === 'home'
          ? '/'
          : `/${route.name}`

  const meta = PAGE_TITLES[route.name] ?? PAGE_TITLES.home

  const submitSearch = () => {
    const q = term.trim()
    navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  const openRandom = () => {
    if (!items.length) return
    const pick = items[Math.floor(Math.random() * items.length)]
    navigate(`/item/${pick.id}`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <div className="brand-mark">绘</div>
          <div className="brand-text">
            <div className="brand-title">绘日记</div>
            <div className="brand-sub">Namori Diary</div>
          </div>
        </a>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((entry) => (
                <a
                  key={entry.path}
                  href={`#${entry.path}`}
                  className={`nav-item${activePath === entry.path ? ' active' : ''}`}
                  title={entry.label}
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
        <div className="sidebar-foot">
          <div className="sidebar-meta">
            <span>作品</span>
            <strong>{items.length}</strong>
          </div>
          <div className="sidebar-meta">
            <span>待校对</span>
            <strong>{pendingCount}</strong>
          </div>
          <button className="btn btn-soft btn-sm" onClick={toggleTheme} title="切换主题">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            <span>{theme === 'dark' ? '亮色主题' : '暗色主题'}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
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
          <button className="icon-btn" onClick={openRandom} title="随机抽一张">
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
    </div>
  )
}
