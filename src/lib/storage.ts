import { BUILTIN_DIMENSIONS, EXTRA_DIMENSIONS } from './constants'
import type { Dimension, ItemAnnotation, Tag, UserData } from '../types'

export const STORAGE_KEY = 'namori.diary.userdata.v2'
export const THEME_KEY = 'namori.theme'

export function emptyAnnotation(): ItemAnnotation {
  return { tags: [], favorite: false, excluded: false, note: '', updatedAt: new Date(0).toISOString() }
}

export function defaultDimensions(): Dimension[] {
  return [...BUILTIN_DIMENSIONS, ...EXTRA_DIMENSIONS].map((d) => ({ ...d }))
}

export function emptyUserData(): UserData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    dimensions: defaultDimensions(),
    tags: [],
    collections: [],
    items: {},
  }
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** 把任意来源的数据（localStorage / 导入文件 / 种子）整理成完整 schema */
export function normalizeUserData(raw: unknown): UserData {
  const base = emptyUserData()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<UserData>

  const dimensions: Dimension[] = base.dimensions.map((builtin) => {
    const found = Array.isArray(data.dimensions)
      ? data.dimensions.find((d) => d && d.id === builtin.id)
      : undefined
    return { ...builtin, ...(found ? { name: str(found.name, builtin.name) } : {}) }
  })
  if (Array.isArray(data.dimensions)) {
    for (const d of data.dimensions) {
      if (!d || !d.id || dimensions.some((x) => x.id === d.id)) continue
      dimensions.push({ id: d.id, name: str(d.name, '未命名维度'), order: dimensions.length })
    }
  }

  const tags: Tag[] = []
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      if (!t || !t.id || !t.name) continue
      if (tags.some((x) => x.id === t.id)) continue
      const dimensionId =
        t.dimensionId && dimensions.some((d) => d.id === t.dimensionId) ? t.dimensionId : 'custom'
      tags.push({
        id: t.id,
        name: str(t.name),
        dimensionId,
        color: str(t.color, '#b0553b'),
        createdAt: str(t.createdAt, new Date().toISOString()),
      })
    }
  }

  const tagIds = new Set(tags.map((t) => t.id))
  const collections = Array.isArray(data.collections)
    ? data.collections
        .filter((c) => c && c.id && c.name)
        .map((c) => ({
          id: c.id,
          name: str(c.name),
          description: str(c.description),
          coverItemId: c.coverItemId ? str(c.coverItemId) : undefined,
          itemIds: Array.isArray(c.itemIds) ? [...new Set(c.itemIds.filter((x) => typeof x === 'string'))] : [],
          createdAt: str(c.createdAt, new Date().toISOString()),
          updatedAt: str(c.updatedAt, new Date().toISOString()),
        }))
    : []

  const items: Record<string, ItemAnnotation> = {}
  if (data.items && typeof data.items === 'object') {
    for (const [id, value] of Object.entries(data.items)) {
      if (!value || typeof value !== 'object') continue
      const a = value as Partial<ItemAnnotation>
      const ann: ItemAnnotation = {
        tags: Array.isArray(a.tags) ? [...new Set(a.tags.filter((t) => tagIds.has(t)))] : [],
        favorite: Boolean(a.favorite),
        excluded: Boolean(a.excluded),
        note: str(a.note),
        updatedAt: str(a.updatedAt, new Date().toISOString()),
      }
      if (a.date && typeof a.date === 'object' && a.date.year && a.date.month && a.date.day) {
        ann.date = {
          year: Number(a.date.year),
          month: Number(a.date.month),
          day: Number(a.date.day),
          confirmed: Boolean(a.date.confirmed),
          source: a.date.source === 'published' || a.date.source === 'manual' ? a.date.source : 'inferred',
        }
      }
      if (a.study && typeof a.study === 'object') {
        ann.study = {
          composition: str(a.study.composition),
          palette: str(a.study.palette),
          linework: str(a.study.linework),
          expression: str(a.study.expression),
          memo: str(a.study.memo),
        }
      }
      if (a.crop && typeof a.crop === 'object') {
        ann.crop = {
          cx: Number(a.crop.cx ?? 0.5),
          cy: Number(a.crop.cy ?? 0.5),
          size: Number(a.crop.size ?? 1),
          tolerance: Number(a.crop.tolerance ?? 18),
          transparent: a.crop.transparent !== false,
        }
      }
      items[id] = ann
    }
  }

  return {
    version: 2,
    updatedAt: str(data.updatedAt, new Date().toISOString()),
    dimensions,
    tags,
    collections,
    items,
  }
}

export function loadLocalUserData(): UserData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeUserData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveLocalUserData(data: UserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('本地存储写入失败（可能超出配额）', err)
  }
}

/** 读取仓库里的种子标注，用于发布整理成果 */
export async function loadSeedUserData(signal?: AbortSignal): Promise<UserData | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/userdata.seed.json`, {
      signal,
      cache: 'no-cache',
    })
    if (!res.ok) return null
    const json = await res.json()
    return normalizeUserData(json)
  } catch {
    return null
  }
}

/** 合并两份数据：标签/维度按 id 去重，单图标注以 incoming 为准（标签取并集） */
export function mergeUserData(current: UserData, incoming: UserData): UserData {
  const dimensions = [...current.dimensions]
  for (const dim of incoming.dimensions) {
    const existing = dimensions.find((d) => d.id === dim.id)
    if (!existing) dimensions.push(dim)
    else if (!existing.builtIn) existing.name = dim.name
  }

  const tags = [...current.tags]
  for (const tag of incoming.tags) {
    const existing = tags.find((t) => t.id === tag.id)
    if (!existing) tags.push(tag)
    else {
      existing.name = tag.name
      existing.color = tag.color
      existing.dimensionId = tag.dimensionId
    }
  }

  const collections = [...current.collections]
  for (const col of incoming.collections) {
    const existing = collections.find((c) => c.id === col.id)
    if (!existing) collections.push(col)
    else {
      existing.name = col.name
      existing.description = col.description
      existing.itemIds = [...new Set([...existing.itemIds, ...col.itemIds])]
      existing.coverItemId = existing.coverItemId || col.coverItemId
    }
  }

  const items: Record<string, ItemAnnotation> = { ...current.items }
  for (const [id, ann] of Object.entries(incoming.items)) {
    const existing = items[id]
    if (!existing) {
      items[id] = ann
      continue
    }
    items[id] = {
      ...existing,
      ...ann,
      tags: [...new Set([...existing.tags, ...ann.tags])],
      favorite: existing.favorite || ann.favorite,
      excluded: existing.excluded || ann.excluded,
      note: ann.note || existing.note,
      date: ann.date ?? existing.date,
      study: ann.study ?? existing.study,
      crop: ann.crop ?? existing.crop,
    }
  }

  return { version: 2, updatedAt: new Date().toISOString(), dimensions, tags, collections, items }
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function annotationCount(data: UserData): number {
  return Object.values(data.items).filter(
    (a) => a.tags.length > 0 || a.favorite || a.excluded || a.note || a.date || a.study || a.crop,
  ).length
}
