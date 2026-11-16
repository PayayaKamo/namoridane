import { useEffect, useState } from 'react'
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
import { ReviewView } from './views/ReviewView'
import { TagsView } from './views/TagsView'
import { CollectionsView } from './views/CollectionsView'
import { StickersView } from './views/StickersView'
import { ReaderView } from './views/ReaderView'
import { CharactersView } from './views/CharactersView'
import { StatsView } from './views/StatsView'
import { DataView } from './views/DataView'
import { DetailView } from './views/DetailView'

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
      return <ReviewView />
    case 'tags':
      return <TagsView />
    case 'characters':
      return <CharactersView />
    case 'collections':
    case 'collection':
      return <CollectionsView route={route} />
    case 'stickers':
      return <StickersView route={route} />
    case 'reader':
      return <ReaderView route={route} />
    case 'stats':
      return <StatsView />
    case 'data':
      return <DataView />
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
