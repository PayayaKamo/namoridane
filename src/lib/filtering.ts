import type { DiaryItem, EffectiveDate, FilterState, ItemAnnotation, Tag } from '../types'
import { effectiveDate } from './dates'

export const DEFAULT_FILTER: FilterState = {
  keyword: '',
  year: '',
  month: '',
  from: '',
  to: '',
  tagIds: [],
  tagMode: 'any',
  dimensionModes: {},
  favoriteOnly: false,
  unconfirmedOnly: false,
  collectionId: '',
  sort: 'publishedAsc',
}

export interface FilterContextInput {
  items: DiaryItem[]
  annotations: Record<string, ItemAnnotation>
  tags: Tag[]
  collectionItemIds?: string[]
}

function searchText(item: DiaryItem, ann: ItemAnnotation | undefined, tagNames: string[], date: EffectiveDate) {
  const parts = [
    item.id,
    item.file,
    item.publishedAt,
    date.iso,
    ann?.note ?? '',
    ann?.study?.composition ?? '',
    ann?.study?.palette ?? '',
    ann?.study?.linework ?? '',
    ann?.study?.expression ?? '',
    ann?.study?.memo ?? '',
    ...tagNames,
  ]
  return parts.join(' ').toLowerCase()
}

export function applyFilters(input: FilterContextInput, filter: FilterState): DiaryItem[] {
  const tagMap = new Map(input.tags.map((t) => [t.id, t]))
  const collectionSet = filter.collectionId ? new Set(input.collectionItemIds ?? []) : null
  const keywords = filter.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean)

  // 选中的标签按维度分组，维度内按 any/all，维度之间 AND
  const selectedByDim = new Map<string, Set<string>>()
  for (const tagId of filter.tagIds) {
    const tag = tagMap.get(tagId)
    const dim = tag?.dimensionId ?? 'custom'
    if (!selectedByDim.has(dim)) selectedByDim.set(dim, new Set())
    selectedByDim.get(dim)!.add(tagId)
  }

  const result = input.items.filter((item) => {
    if (collectionSet && !collectionSet.has(item.id)) return false
    const ann = input.annotations[item.id]
    const date = effectiveDate(item, ann)

    if (filter.favoriteOnly && !ann?.favorite) return false
    if (filter.unconfirmedOnly && date.confirmed) return false
    if (filter.year && String(date.year) !== filter.year) return false
    if (filter.month && String(date.month) !== filter.month) return false
    if (filter.from && date.iso < filter.from) return false
    if (filter.to && date.iso > filter.to) return false

    if (selectedByDim.size) {
      const annTags = new Set(ann?.tags ?? [])
      for (const [dim, ids] of selectedByDim) {
        const mode = filter.dimensionModes[dim] ?? filter.tagMode
        const hit =
          mode === 'all'
            ? [...ids].every((id) => annTags.has(id))
            : [...ids].some((id) => annTags.has(id))
        if (!hit) return false
      }
    }

    if (keywords.length) {
      const names = (ann?.tags ?? []).map((id) => tagMap.get(id)?.name ?? '')
      const haystack = searchText(item, ann, names, date)
      if (!keywords.every((k) => haystack.includes(k))) return false
    }
    return true
  })

  const annTime = (item: DiaryItem) => {
    const t = input.annotations[item.id]?.updatedAt
    return t ? new Date(t).getTime() : 0
  }
  const diaryKey = (item: DiaryItem) => effectiveDate(item, input.annotations[item.id]).iso

  switch (filter.sort) {
    case 'publishedDesc':
      result.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : a.postIndex - b.postIndex))
      break
    case 'diaryAsc':
      result.sort((a, b) => diaryKey(a).localeCompare(diaryKey(b)) || a.postIndex - b.postIndex)
      break
    case 'diaryDesc':
      result.sort((a, b) => diaryKey(b).localeCompare(diaryKey(a)) || b.postIndex - a.postIndex)
      break
    case 'updatedDesc':
      result.sort((a, b) => annTime(b) - annTime(a))
      break
    case 'publishedAsc':
    default:
      result.sort((a, b) => (a.publishedAt > b.publishedAt ? 1 : a.publishedAt < b.publishedAt ? -1 : a.postIndex - b.postIndex))
      break
  }
  return result
}

export function groupByMonth<T extends DiaryItem>(
  items: T[],
  annotations: Record<string, ItemAnnotation>,
): { key: string; year: number; month: number; items: T[] }[] {
  const groups = new Map<string, { key: string; year: number; month: number; items: T[] }>()
  for (const item of items) {
    const d = effectiveDate(item, annotations[item.id])
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`
    if (!groups.has(key)) groups.set(key, { key, year: d.year, month: d.month, items: [] })
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** 相似作品：标签重合 + 色板相似度 */
export function similarItems(
  target: DiaryItem,
  all: DiaryItem[],
  annotations: Record<string, ItemAnnotation>,
  limit = 8,
): { item: DiaryItem; score: number; shared: number }[] {
  const targetTags = new Set(annotations[target.id]?.tags ?? [])
  const scored: { item: DiaryItem; score: number; shared: number }[] = []
  for (const item of all) {
    if (item.id === target.id) continue
    const tags = annotations[item.id]?.tags ?? []
    const shared = tags.filter((t) => targetTags.has(t)).length
    const tagScore = targetTags.size ? shared / Math.max(targetTags.size, 1) : 0
    let paletteScore = 0
    if (target.palette?.length && item.palette?.length) {
      let totalMin = 0
      for (let i = 0; i < target.palette.length; i++) {
        let best = 999
        for (let j = 0; j < item.palette.length; j++) {
          const a = target.palette[i]
          const b = item.palette[j]
          const dr = parseInt(a.slice(1, 3), 16) - parseInt(b.slice(1, 3), 16)
          const dg = parseInt(a.slice(3, 5), 16) - parseInt(b.slice(3, 5), 16)
          const db = parseInt(a.slice(5, 7), 16) - parseInt(b.slice(5, 7), 16)
          best = Math.min(best, Math.sqrt(dr * dr + dg * dg + db * db))
        }
        totalMin += best
      }
      paletteScore = Math.max(0, 1 - totalMin / target.palette.length / 110)
    }
    const score = tagScore * 0.62 + paletteScore * 0.38
    if (score > 0.35) scored.push({ item, score, shared })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
