import type { DiaryItem, EffectiveDate } from '../types'
import type { Route as AppRoute, RouteName } from './router'
import { translate } from '../i18n/core'

export const SITE_URL = 'https://payayakamo.github.io/namoridane/'
export const SITE_NAME = '水母绘日记 · Namori Diary'
export const OG_COVER = `${SITE_URL}og-cover.jpg`

const DEFAULT_DESCRIPTION =
  '收录 Namori（@namoridane）发布在 Instagram 的 1,000+ 张手绘「水母绘日记」插画。可按日历、日期、角色与标签浏览检索，查看原文案、临摹拆解与翻译整理。'

interface PageMeta {
  title: string
  description: string
}

const ROUTE_META: Partial<Record<RouteName, PageMeta>> = {
  home: {
    title: '水母绘日记 · Namori Diary — Namori 手绘绘日记插画集',
    description: DEFAULT_DESCRIPTION,
  },
  gallery: {
    title: '图库 · 水母绘日记 Namori Diary',
    description: '按年份与月份浏览 Namori 的全部手绘水母绘日记，可按标签、角色与翻译状态筛选，查看每张作品的大图与原帖。',
  },
  calendar: {
    title: '日历 · 水母绘日记 Namori Diary',
    description: '用日历方式翻阅 Namori 的水母绘日记，看看每一天画了什么，按年份与月份快速定位。',
  },
  reader: {
    title: '翻阅 · 水母绘日记 Namori Diary',
    description: '沉浸式逐页翻阅 Namori 的手绘绘日记，支持键盘切换与连续阅读。',
  },
  search: {
    title: '搜索与筛选 · 水母绘日记 Namori Diary',
    description: '按关键词、日期、标签、角色与翻译状态搜索 Namori 的水母绘日记插画。',
  },
  characters: {
    title: '角色图鉴 · 水母绘日记 Namori Diary',
    description: '按角色聚合 Namori 绘日记中的全部出场，查看每个角色的作品与头像。',
  },
  storylines: {
    title: '故事线 · 水母绘日记 Namori Diary',
    description: '把绘日记按主题串成故事线，按顺序重读 Namori 的手绘日常。',
  },
  stats: {
    title: '统计 · 水母绘日记 Namori Diary',
    description: '查看水母绘日记的收录数量、年份分布、标签与角色出场统计。',
  },
  datefind: {
    title: '按日期查绘日记 · 水母绘日记 Namori Diary',
    description: '输入月日或日期，查找 Namori 在同一天画下的绘日记。',
  },
  collections: {
    title: '合集 · 水母绘日记 Namori Diary',
    description: '把喜欢的绘日记收进同一本册子，按主题整理临摹参考。',
  },
  tags: {
    title: '标签 · 水母绘日记 Namori Diary',
    description: '浏览水母绘日记的标签体系与使用情况。',
  },
}

function ensureMeta(kind: 'name' | 'property', key: string): HTMLMetaElement {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${kind}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(kind, key)
    document.head.appendChild(element)
  }
  return element
}

function setMeta(kind: 'name' | 'property', key: string, value: string): void {
  ensureMeta(kind, key).setAttribute('content', value)
}

function setCanonical(url: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = url
}

function setItemJsonLd(payload: unknown | null): void {
  const id = 'item-seo-jsonld'
  const existing = document.getElementById(id)
  if (!payload) {
    existing?.remove()
    return
  }
  const script = (existing as HTMLScriptElement | null) ?? document.createElement('script')
  script.id = id
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(payload)
  if (!existing) document.head.appendChild(script)
}

/** 路由级标题、描述与分享卡（作品详情由 GalleryView 单独覆盖） */
export function applyRouteSeo(route: AppRoute): void {
  if (route.name === 'item') return
  const meta = ROUTE_META[route.name] ?? ROUTE_META.home!
  const url = SITE_URL
  document.title = meta.title
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', OG_COVER)
  setMeta('property', 'og:image:type', 'image/jpeg')
  setMeta('property', 'og:image:width', '1200')
  setMeta('property', 'og:image:height', '630')
  setMeta('property', 'og:image:alt', '三张 Namori 水母绘日记手绘插画拼贴')
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  setMeta('name', 'twitter:image', OG_COVER)
  setMeta('name', 'twitter:image:alt', '三张 Namori 水母绘日记手绘插画拼贴')
  setCanonical(url)
  setItemJsonLd(null)
}

function captionSnippet(caption: string | null): string {
  if (!caption) return ''
  const text = caption.replace(/\s+/g, ' ').trim()
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

/** 单张作品的独立地址与分享卡信息 */
export function applyItemSeo(item: DiaryItem, date: EffectiveDate | null, tagNames: string[]): void {
  const url = `${SITE_URL}item/${encodeURIComponent(item.id)}/`
  const image = `${SITE_URL}${item.original}`
  const iso = date?.iso || item.publishedAt
  const site = translate('shell.siteName')
  const title = iso
    ? translate('lib.seo.itemTitle', { date: iso, site })
    : translate('lib.seo.itemTitleNoDate', { site })
  const tagText = tagNames.length ? `出场：${tagNames.slice(0, 4).join('、')}。` : ''
  const snippet = captionSnippet(item.caption)
  const description = `Namori 的手绘绘日记${iso ? `（${iso}）` : ''}。${tagText}${snippet || '可查看大图、原文案与临摹拆解。'}`

  document.title = title
  setMeta('name', 'description', description)
  setMeta('property', 'og:type', 'article')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:type', 'image/jpeg')
  setMeta('property', 'og:image:width', String(item.w))
  setMeta('property', 'og:image:height', String(item.h))
  setMeta('property', 'og:image:alt', `Namori 水母绘日记 ${iso} 手绘插画`)
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)
  setMeta('name', 'twitter:image:alt', `Namori 水母绘日记 ${iso} 手绘插画`)
  setCanonical(url)

  setItemJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `${url}#image`,
    url,
    contentUrl: image,
    thumbnailUrl: `${SITE_URL}${item.thumb}`,
    name: title,
    caption: description,
    datePublished: item.publishedAt || undefined,
    creator: { '@type': 'Person', name: 'Namori', sameAs: 'https://www.instagram.com/namoridane' },
    isPartOf: { '@id': `${SITE_URL}#website` },
    width: item.w,
    height: item.h,
    encodingFormat: 'image/jpeg',
  })
}
