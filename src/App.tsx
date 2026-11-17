import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from './lib/router'
import { navigate } from './lib/router'
import { useStore } from './state/store'
import { Layout } from './components/Layout'
import { Modal, Toasts } from './components/Modal'
import { Icon } from './components/Icon'
import { HomeView } from './views/HomeView'
import { CalendarView } from './views/CalendarView'
import { GalleryView } from './views/GalleryView'
import { SearchView } from './views/SearchView'
import { StorylineView } from './views/StorylineView'
import { DateFindView } from './views/DateFindView'
import { StickersView } from './views/StickersView'
import { ReaderView } from './views/ReaderView'
import { CharactersView } from './views/CharactersView'
import { DetailView } from './views/DetailView'

// 管理端视图只在 admin 构建中打包；public 构建会把下面的分支整体折叠掉。
const ReviewView =
  __APP_MODE__ === 'public' ? null : lazy(() => import('./views/ReviewView').then((m) => ({ default: m.ReviewView })))
const DiaryReviewView =
  __APP_MODE__ === 'public'
    ? null
    : lazy(() => import('./views/DiaryReviewView').then((m) => ({ default: m.DiaryReviewView })))
const TagsView =
  __APP_MODE__ === 'public' ? null : lazy(() => import('./views/TagsView').then((m) => ({ default: m.TagsView })))
const CollectionsView =
  __APP_MODE__ === 'public'
    ? null
    : lazy(() => import('./views/CollectionsView').then((m) => ({ default: m.CollectionsView })))
const StatsView =
  __APP_MODE__ === 'public' ? null : lazy(() => import('./views/StatsView').then((m) => ({ default: m.StatsView })))
const DataView =
  __APP_MODE__ === 'public' ? null : lazy(() => import('./views/DataView').then((m) => ({ default: m.DataView })))

function AdminFallback() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      正在载入管理功能…
    </div>
  )
}

function adminOnly(view: JSX.Element | null, fallback: JSX.Element = <HomeView />) {
  return view ? <Suspense fallback={<AdminFallback />}>{view}</Suspense> : fallback
}

function CurrentView({ route }: { route: ReturnType<typeof useRoute> }) {
  switch (route.name) {
    case 'home':
      return <HomeView />
    case 'calendar':
      return <CalendarView route={route} />
    case 'gallery':
      return <GalleryView route={route} />
    case 'search':
      return <SearchView route={route} />
    case 'review':
      return adminOnly(ReviewView ? <ReviewView /> : null)
    case 'diary-review':
      return adminOnly(DiaryReviewView ? <DiaryReviewView /> : null)
    case 'tags':
      return adminOnly(TagsView ? <TagsView /> : null)
    case 'characters':
      return <CharactersView />
    case 'collections':
    case 'collection':
      return adminOnly(CollectionsView ? <CollectionsView route={route} /> : null)
    case 'storylines':
    case 'storyline':
      return <StorylineView />
    case 'datefind':
      return <DateFindView route={route} />
    case 'stickers':
      return <StickersView route={route} />
    case 'reader':
      return <ReaderView route={route} />
    case 'stats':
      return adminOnly(StatsView ? <StatsView /> : null)
    case 'data':
      return adminOnly(DataView ? <DataView /> : null)
    case 'item':
      return <GalleryView route={route} />
    default:
      return <HomeView />
  }
}

export default function App() {
  const { loading, error, toasts, dismissToast, items } = useStore()
  const route = useRoute()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.top-search input')?.focus()
      } else if (e.key === '?' && !typing) {
        setShortcutsOpen(true)
      } else if (e.key.toLowerCase() === 'r' && !typing && !e.ctrlKey && !e.metaKey) {
        if (!items.length) return
        const pick = items[Math.floor(Math.random() * items.length)]
        navigate(`/item/${pick.id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        正在载入绘日记…
      </div>
    )
  }

  if (error) {
    return (
      <div className="loading-screen" style={{ padding: 40, textAlign: 'center' }}>
        <div className="empty-title">没有找到图片索引</div>
        <div className="muted">
          请在项目目录运行 <code>npm run data</code> 生成索引与衍生图，然后刷新页面。（{error}）
        </div>
      </div>
    )
  }

  return (
    <>
      <Layout route={route}>
        <CurrentView route={route} />
      </Layout>
      {route.name === 'item' && route.param && <DetailView itemId={route.param} />}
      {shortcutsOpen && <ShortcutPanel onClose={() => setShortcutsOpen(false)} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

function ShortcutPanel({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['← / →', '上一张 / 下一张'],
    ['Esc', '关闭详情或弹层'],
    ['/', '聚焦搜索框'],
    ['R', '随机抽一张'],
    ['F', '收藏当前作品'],
    ['1 / 2', '详情中切换「信息 / 表情包」'],
    ['?', '打开本快捷键面板'],
  ]
  return (
    <Modal title="快捷键" onClose={onClose}>
      <div className="shortcut-list">
        {rows.map(([key, desc]) => (
          <div key={key} className="shortcut-row">
            <kbd>{key}</kbd>
            <span>{desc}</span>
            <Icon name="info" size={14} />
          </div>
        ))}
      </div>
    </Modal>
  )
}
