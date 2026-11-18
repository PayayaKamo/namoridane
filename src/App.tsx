import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from './lib/router'
import { navigate } from './lib/router'
import { useStore } from './state/store'
import { useI18n } from './i18n'
import { Layout } from './components/Layout'
import { Modal, Toasts } from './components/Modal'
import { Icon } from './components/Icon'
import { ErrorBoundary, UnhandledRejectionBanner } from './components/ErrorBoundary'
import { HomeView } from './views/HomeView'
import { CalendarView } from './views/CalendarView'
import { GalleryView } from './views/GalleryView'
import { SearchView } from './views/SearchView'
import { StorylineView } from './views/StorylineView'
import { DateFindView } from './views/DateFindView'
import { ReaderView } from './views/ReaderView'
import { CharactersView } from './views/CharactersView'
import { StatsView } from './views/StatsView'
import { AboutView } from './views/AboutView'
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
const DataView =
  __APP_MODE__ === 'public' ? null : lazy(() => import('./views/DataView').then((m) => ({ default: m.DataView })))
const CharacterTaggingView =
  __APP_MODE__ === 'public'
    ? null
    : lazy(() =>
        import('./views/CharacterTaggingView').then((m) => ({ default: m.CharacterTaggingView })),
      )

function AdminFallback() {
  const { t } = useI18n()
  return (
    <div className="loading-screen">
      <div className="spinner" />
      {t('shell.app.adminLoading')}
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
      return <CharactersView route={route} />
    case 'character-tagging':
      return adminOnly(CharacterTaggingView ? <CharacterTaggingView /> : null)
    case 'collections':
    case 'collection':
      return adminOnly(CollectionsView ? <CollectionsView route={route} /> : null)
    case 'storylines':
    case 'storyline':
      return <StorylineView />
    case 'datefind':
      return <DateFindView route={route} />
    case 'reader':
      return <ReaderView route={route} />
    case 'stats':
      return <StatsView />
    case 'data':
      return adminOnly(DataView ? <DataView /> : null)
    case 'about':
      return <AboutView />
    case 'item':
      return <GalleryView route={route} />
    default:
      return <HomeView />
  }
}

export default function App() {
  const { loading, error, toasts, dismissToast, items } = useStore()
  const { t } = useI18n()
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
        {t('shell.app.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="loading-screen" style={{ padding: 40, textAlign: 'center' }}>
        <div className="empty-title">{t('shell.app.noIndexTitle')}</div>
        <div className="muted">
          {t('shell.app.noIndexHintBefore')} <code>npm run data</code>{t('shell.app.noIndexHintAfter', { error })}
        </div>
      </div>
    )
  }

  return (
    <>
      <Layout route={route}>
        <ErrorBoundary key={`${route.name}:${route.param}`}>
          <CurrentView route={route} />
        </ErrorBoundary>
      </Layout>
      {route.name === 'item' && route.param && (
        <ErrorBoundary key={`detail:${route.param}`}>
          <DetailView itemId={route.param} />
        </ErrorBoundary>
      )}
      {shortcutsOpen && <ShortcutPanel onClose={() => setShortcutsOpen(false)} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <UnhandledRejectionBanner />
    </>
  )
}

function ShortcutPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const rows: [string, string][] = [
    ['← / →', t('shell.shortcuts.prevNext')],
    ['Esc', t('shell.shortcuts.close')],
    ['/', t('shell.shortcuts.focusSearch')],
    ['R', t('shell.shortcuts.random')],
    ['F', t('shell.shortcuts.favorite')],
    ['1 / 2', t('shell.shortcuts.tabs')],
    ['?', t('shell.shortcuts.panel')],
  ]
  return (
    <Modal title={t('shell.shortcuts.title')} onClose={onClose}>
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
