import { useEffect, useState } from 'react'

export type RouteName =
  | 'home'
  | 'calendar'
  | 'gallery'
  | 'search'
  | 'reader'
  | 'stats'
  | 'tags'
  | 'characters'
  | 'collections'
  | 'collection'
  | 'storylines'
  | 'storyline'
  | 'datefind'
  | 'stickers'
  | 'review'
  | 'diary-review'
  | 'data'
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
  'collections',
  'collection',
  'storylines',
  'storyline',
  'datefind',
  'stickers',
  'review',
  'diary-review',
  'data',
  'item',
]

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [pathPart, queryPart = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const first = (segments[0] || 'home') as RouteName
  const name = KNOWN.includes(first) ? first : 'home'
  return { name, param: segments[1] ? decodeURIComponent(segments[1]) : '', query: new URLSearchParams(queryPart) }
}

export function navigate(path: string, replace = false): void {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`
  if (window.location.hash === target) return
  if (replace) {
    history.replaceState(null, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

let returnHash = '#/gallery'

export function rememberView(): void {
  const current = window.location.hash
  if (current && !current.startsWith('#/item/')) returnHash = current
}

export function openItem(id: string): void {
  rememberView()
  navigate(`/item/${id}`)
}

export function closeItem(): void {
  navigate(returnHash.replace(/^#/, ''))
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
