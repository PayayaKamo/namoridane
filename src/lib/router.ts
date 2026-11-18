import { useEffect, useState } from 'react'
import { applyRouteSeo } from './seo'

export type RouteName =
  | 'home'
  | 'calendar'
  | 'gallery'
  | 'search'
  | 'reader'
  | 'stats'
  | 'tags'
  | 'characters'
  | 'character-tagging'
  | 'collections'
  | 'collection'
  | 'storylines'
  | 'storyline'
  | 'datefind'
  | 'review'
  | 'diary-review'
  | 'data'
  | 'about'
  | 'item'

export interface Route {
  name: RouteName
  param: string
  query: URLSearchParams
}

const KNOWN: RouteName[] = [
  'home',
  'calendar',
  'gallery',
  'search',
  'reader',
  'stats',
  'tags',
  'characters',
  'character-tagging',
  'collections',
  'collection',
  'storylines',
  'storyline',
  'datefind',
  'review',
  'diary-review',
  'data',
  'about',
  'item',
]

/** 站点部署根路径：开发/管理端为 /，公开构建为 /namoridane/ */
const BASE_PATH = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/'

export function parsePath(path: string): Route {
  const raw = path.replace(/^#/, '')
  const [pathPart, queryPart = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const first = (segments[0] || 'home') as RouteName
  const name = KNOWN.includes(first) ? first : 'home'
  return { name, param: segments[1] ? decodeURIComponent(segments[1]) : '', query: new URLSearchParams(queryPart) }
}

/** 读取当前地址栏对应站内路径（去掉部署子路径，保留查询串） */
export function currentPath(): string {
  const prefix = BASE_PATH.replace(/\/$/, '')
  let path = window.location.pathname
  if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length)
  if (!path.startsWith('/')) path = `/${path}`
  return `${path}${window.location.search}`
}

/** 把站内路径转换为可直接写入地址栏的 URL */
export function pathToUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BASE_PATH.replace(/\/$/, '')}${normalized}`
}

/** 站内链接：用于 <a href>，保持可复制、可被无 JS 环境识别 */
export function siteHref(path: string): string {
  return pathToUrl(path)
}

/**
 * 兼容改造前已经分享出去的 hash 链接（/#/item/xxx、/#/reader…）。
 * 打开旧链接时原地改写为新地址，不新增历史记录。
 */
export function migrateLegacyHash(): boolean {
  const hash = window.location.hash
  if (!hash.startsWith('#/')) return false
  let legacy = hash.slice(1) || '/'
  // 作品页统一使用带斜杠的目录地址，和静态文件、canonical 保持一致
  if (/^\/item\/[^/?#]+$/.test(legacy)) legacy = `${legacy}/`
  const target = pathToUrl(legacy)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (current !== target) {
    history.replaceState(history.state, '', target)
  }
  return true
}

migrateLegacyHash()

export function navigate(path: string, replace = false): void {
  const target = pathToUrl(path)
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === target) return
  if (replace) history.replaceState(history.state, '', target)
  else history.pushState(history.state, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parsePath(currentPath()))
  useEffect(() => {
    applyRouteSeo(route)
  }, [route])
  useEffect(() => {
    const onChange = () => setRoute(parsePath(currentPath()))
    const onHashChange = () => {
      // 用户手动把地址改回旧 hash 形式时，同样迁移到新地址
      if (migrateLegacyHash()) onChange()
    }
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])
  return route
}

// 把仍以 hash 形式书写的站内链接统一交给 History 路由处理。
// 这样旧组件里的 href="#/gallery" 不会触发整页刷新，地址栏也会变成新格式。
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    const anchor = (event.target as Element | null)?.closest?.('a[href^="#/"]') as HTMLAnchorElement | null
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return
    const href = anchor.getAttribute('href')
    if (!href) return
    event.preventDefault()
    navigate(href.slice(1))
  })
}

let returnPath = '/gallery'

export function rememberView(): void {
  const current = currentPath()
  if (current && !current.startsWith('/item/')) returnPath = current
}

export function openItem(id: string): void {
  rememberView()
  navigate(`/item/${id}/`)
}

export function closeItem(): void {
  navigate(returnPath)
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const q = search.toString()
  return q ? `?${q}` : ''
}
