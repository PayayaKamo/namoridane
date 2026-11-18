import type { Collection, DiaryItem, ItemAnnotation, Tag } from '../types'
import { effectiveDate, formatFullDate } from './dates'
import { translate, type MessageKey } from '../i18n/core'

/**
 * 轻量前端搜索：为约 1,100 条索引建立字段文档，支持多关键词 AND、
 * 精确 / 前缀 / 容错匹配与命中片段定位。没有外部依赖，也不引入搜索服务。
 */

export type SearchFieldKind =
  | 'caption'
  | 'shortcode'
  | 'date'
  | 'tag'
  | 'character'
  | 'note'
  | 'translation'
  | 'study'
  | 'collection'
  | 'file'

export interface SearchField {
  kind: SearchFieldKind
  /** 展示用字段名，例如「文案」「人物」「备注」 */
  label: string
  /** 字段权重，命中时参与排序 */
  weight: number
  /** 原始文本，用于展示与高亮 */
  text: string
  /** 归一化文本，用于匹配；与 text 等长时高亮下标可直接复用 */
  norm: string
}

export interface SearchDoc {
  item: DiaryItem
  fields: SearchField[]
  /** 有效日期，用于同日结果排序 */
  dateIso: string
}

export interface SearchMatch {
  kind: SearchFieldKind
  label: string
  text: string
  /** 命中区间（UTF-16 下标），基于 norm；text 与 norm 等长时可直接用于高亮 */
  ranges: [number, number][]
}

export interface SearchHit {
  item: DiaryItem
  /** 相关度，越高越靠前 */
  score: number
  matches: SearchMatch[]
}

export interface SearchResult {
  hits: SearchHit[]
  keywords: string[]
  /** 未命中任何字段的关键词 */
  missed: string[]
  /** 无结果时推荐的相近关键词 */
  suggestions: string[]
  /** 关键词只命中一部分的条目数量，用于提示「放宽为任一关键词」 */
  partialCount: number
}

export interface SearchInput {
  items: DiaryItem[]
  annotations: Record<string, ItemAnnotation>
  tags: Tag[]
  collections?: Collection[]
}

const FIELD_WEIGHTS: Record<SearchFieldKind, number> = {
  shortcode: 1.18,
  character: 1.12,
  tag: 1.06,
  caption: 1.02,
  note: 0.96,
  translation: 0.92,
  date: 0.88,
  study: 0.8,
  collection: 0.72,
  file: 0.55,
}

const MAX_KEYWORDS = 6
const MAX_FUZZY_FIELD_LENGTH = 320

/** NFKC + 小写：全角转半角，英文不区分大小写 */
export function normalizeSearchText(input: string): string {
  return input.normalize('NFKC').toLowerCase()
}

/** 空格、中英文逗号、顿号、分号切分关键词；去重并限制数量 */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(/[\s,，、;；]+/)) {
    const keyword = part.trim()
    if (!keyword) continue
    const key = normalizeSearchText(keyword)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(keyword)
    if (result.length >= MAX_KEYWORDS) break
  }
  return result
}

interface FieldSeed {
  kind: SearchFieldKind
  label: string
  text: string
}

function makeField(seed: FieldSeed): SearchField | null {
  const text = seed.text.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return { ...seed, text, norm: normalizeSearchText(text), weight: FIELD_WEIGHTS[seed.kind] }
}

function dateText(year: number, month: number, day: number): string {
  const monthText = String(month)
  const dayText = String(day)
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return [
    formatFullDate(iso),
    iso,
    `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
    `${year} 年 ${monthText} 月 ${dayText} 日`,
    `${monthText} 月 ${dayText} 日`,
    `${monthText}/${dayText}`,
    `${monthText}-${dayText}`,
    `${year}`,
  ].join(' ')
}

function dateSeeds(item: DiaryItem, ann: ItemAnnotation | undefined): FieldSeed[] {
  const seeds: FieldSeed[] = []
  const date = effectiveDate(item, ann)
  if (date.iso) {
    seeds.push({ kind: 'date', label: translate('lib.search.date'), text: dateText(date.year, date.month, date.day) })
  }
  // 发布日是索引里始终可信的日期，公开站也能按发布日搜索
  if (item.publishedAt && item.publishedAt !== date.iso) {
    const [year, month, day] = item.publishedAt.split('-').map(Number)
    if (year && month && day) {
      seeds.push({ kind: 'date', label: translate('lib.search.publishedAt'), text: dateText(year, month, day) })
    }
  }
  return seeds
}

function translationSeeds(ann: ItemAnnotation | undefined): FieldSeed[] {
  const translation = ann?.translation
  if (!translation) return []
  const seeds: FieldSeed[] = []
  if (translation.source.trim()) {
    seeds.push({ kind: 'translation', label: translate('lib.search.source'), text: translation.source })
  }
  if (translation.sourceDraft?.trim()) {
    seeds.push({ kind: 'translation', label: translate('lib.search.sourceDraft'), text: translation.sourceDraft })
  }
  for (const slot of translation.slots ?? []) {
    if (slot.text.trim()) {
      seeds.push({
        kind: 'translation',
        label: translate('lib.search.translationSlot', { name: slot.label || slot.lang }),
        text: slot.text,
      })
    }
  }
  return seeds
}

const STUDY_LABEL_KEYS = {
  composition: 'lib.studyFields.composition.label',
  palette: 'lib.studyFields.palette.label',
  linework: 'lib.studyFields.linework.label',
  expression: 'lib.studyFields.expression.label',
  memo: 'lib.search.study',
} satisfies Record<string, MessageKey>

function studySeeds(ann: ItemAnnotation | undefined): FieldSeed[] {
  const study = ann?.study
  if (!study) return []
  return Object.entries(STUDY_LABEL_KEYS)
    .map(([key, labelKey]) => ({
      kind: 'study' as const,
      label: translate(labelKey),
      text: study[key as keyof typeof study] ?? '',
    }))
    .filter((seed) => seed.text.trim().length > 0)
}

/** 把作品、标注、标签与合集展开成可搜索字段 */
export function buildSearchDocs(input: SearchInput): SearchDoc[] {
  const tagMap = new Map(input.tags.map((tag) => [tag.id, tag]))
  const collectionNames = new Map<string, string[]>()
  for (const collection of input.collections ?? []) {
    for (const itemId of collection.itemIds) {
      const names = collectionNames.get(itemId) ?? []
      names.push(collection.name)
      collectionNames.set(itemId, names)
    }
  }

  return input.items.map((item) => {
    const ann = input.annotations[item.id]
    const seeds: FieldSeed[] = []

    if (item.caption?.trim()) seeds.push({ kind: 'caption', label: translate('lib.search.caption'), text: item.caption })
    seeds.push({ kind: 'shortcode', label: translate('lib.search.shortcode'), text: item.shortcode })
    seeds.push({ kind: 'file', label: translate('lib.search.file'), text: item.file })
    seeds.push(...dateSeeds(item, ann))

    for (const tagId of ann?.tags ?? []) {
      const tag = tagMap.get(tagId)
      if (!tag) continue
      const isCharacter = tag.dimensionId === 'character'
      seeds.push({
        kind: isCharacter ? 'character' : 'tag',
        label: translate(isCharacter ? 'lib.search.character' : 'lib.search.tag'),
        text: tag.name,
      })
    }

    if (ann?.note?.trim()) seeds.push({ kind: 'note', label: translate('lib.search.note'), text: ann.note })
    seeds.push(...translationSeeds(ann))
    seeds.push(...studySeeds(ann))

    for (const name of collectionNames.get(item.id) ?? []) {
      seeds.push({ kind: 'collection', label: translate('lib.search.collection'), text: name })
    }

    const fields = seeds.map(makeField).filter((field): field is SearchField => Boolean(field))
    return {
      item,
      fields,
      dateIso: effectiveDate(item, ann).iso || item.publishedAt,
    }
  })
}

/** 两字以内只容忍 1 个错字，长词放宽到 2 个 */
function maxEditDistance(length: number): number {
  if (length <= 4) return 1
  return 2
}

/** 短关键词只在名称类字段上做容错，避免备注长句产生大量误命中 */
const SHORT_FUZZY_KINDS: ReadonlySet<SearchFieldKind> = new Set([
  'character',
  'tag',
  'caption',
  'collection',
  'shortcode',
])

/** 带早停的编辑距离；超过 max 时直接返回 max + 1 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  if (!la) return lb
  if (!lb) return la

  let prev = new Array<number>(lb + 1)
  let next = new Array<number>(lb + 1)
  for (let j = 0; j <= lb; j += 1) prev[j] = j

  for (let i = 1; i <= la; i += 1) {
    next[0] = i
    let rowMin = i
    const from = Math.max(1, i - max)
    const to = Math.min(lb, i + max)
    for (let j = 1; j < from; j += 1) next[j] = max + 1
    for (let j = from; j <= to; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost)
      next[j] = value
      if (value < rowMin) rowMin = value
    }
    for (let j = to + 1; j <= lb; j += 1) next[j] = max + 1
    if (rowMin > max) return max + 1
    const swap = prev
    prev = next
    next = swap
  }
  return prev[lb]
}

function occurrenceRanges(haystack: string, needle: string): [number, number][] {
  const ranges: [number, number][] = []
  if (!needle) return ranges
  let from = 0
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) break
    ranges.push([index, index + needle.length])
    from = index + needle.length
    if (ranges.length >= 12) break
  }
  return ranges
}

interface FieldMatch {
  score: number
  ranges: [number, number][]
}

interface Segment {
  text: string
  start: number
}

function splitSegments(value: string): Segment[] {
  const segments: Segment[] = []
  const re = /[^\s,，、。.!！?？:：;；()（）[\]【】「」『』/／\\|·~～—_-]+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(value))) {
    if (match[0].length >= 2) segments.push({ text: match[0], start: match.index })
  }
  return segments
}

/** 在长句里滑动窗口做容错匹配，返回最优区间 */
function fuzzyInSegment(segment: Segment, keyword: string, max: number): { distance: number; start: number; length: number } | null {
  let best: { distance: number; start: number; length: number } | null = null
  const baseLength = keyword.length
  const lengths = [baseLength, baseLength + 1, baseLength - 1].filter((len) => len >= 2)
  const limit = Math.min(segment.text.length, MAX_FUZZY_FIELD_LENGTH)

  for (const length of lengths) {
    const last = Math.min(limit, segment.text.length) - length
    for (let start = 0; start <= last; start += 1) {
      const window = segment.text.slice(start, start + length)
      const distance = editDistance(keyword, window, max)
      if (distance > max) continue
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && Math.abs(length - baseLength) < Math.abs(best.length - baseLength))
      ) {
        best = { distance, start: segment.start + start, length }
        if (distance === 0) return best
      }
    }
  }
  return best
}

function matchField(field: SearchField, keyword: string): FieldMatch | null {
  const needle = normalizeSearchText(keyword)
  if (!needle) return null

  const index = field.norm.indexOf(needle)
  if (index >= 0) {
    let score = field.weight
    const before = index === 0 ? '' : field.norm[index - 1]
    if (index === 0 || /[\s,，、。.!！?？:：;；/／\-_()（）]/.test(before)) score *= 1.08
    if (field.norm.trim() === needle) score *= 1.14
    return { score, ranges: occurrenceRanges(field.norm, needle) }
  }

  if (needle.length < 2) return null
  if (needle.length === 2 && !SHORT_FUZZY_KINDS.has(field.kind)) return null
  const max = maxEditDistance(needle.length)
  if (field.norm.length > MAX_FUZZY_FIELD_LENGTH) return null

  // 短词的容错更容易误命中，降低权重让精确结果始终排在前面
  const shortPenalty = needle.length <= 2 ? 0.62 : 1
  let best: { score: number; ranges: [number, number][] } | null = null
  for (const segment of splitSegments(field.norm)) {
    const found = fuzzyInSegment(segment, needle, max)
    if (!found) continue
    const lengthPenalty = Math.abs(found.length - needle.length) / Math.max(found.length, needle.length)
    const score =
      field.weight * Math.max(0.4, 0.9 - found.distance * 0.16 - lengthPenalty * 0.12) * shortPenalty
    if (!best || score > best.score) {
      best = { score, ranges: [[found.start, found.start + found.length]] }
    }
    if (found.distance === 0) break
  }
  return best
}

/** 在文档中为单个关键词找最佳字段 */
function bestFieldMatch(doc: SearchDoc, keyword: string): { field: SearchField; match: FieldMatch } | null {
  let best: { field: SearchField; match: FieldMatch } | null = null
  for (const field of doc.fields) {
    const match = matchField(field, keyword)
    if (!match) continue
    if (!best || match.score > best.match.score) best = { field, match }
  }
  return best
}

function scoreDoc(
  doc: SearchDoc,
  keywords: string[],
): { score: number; matches: SearchMatch[]; matched: number; matchedIndexes: number[] } {
  let score = 0
  const matches: SearchMatch[] = []
  const matchedIndexes: number[] = []
  keywords.forEach((keyword, index) => {
    const hit = bestFieldMatch(doc, keyword)
    if (!hit) return
    matchedIndexes.push(index)
    score += hit.match.score
    matches.push({
      kind: hit.field.kind,
      label: hit.field.label,
      text: hit.field.text,
      ranges: hit.field.text.length === hit.field.norm.length ? hit.match.ranges : [],
    })
  })
  return { score, matches, matched: matchedIndexes.length, matchedIndexes }
}

function vocabularyOf(docs: SearchDoc[]): string[] {
  const words = new Set<string>()
  for (const doc of docs) {
    for (const field of doc.fields) {
      if (field.kind === 'tag' || field.kind === 'character' || field.kind === 'collection') {
        words.add(field.text)
      } else if (field.kind === 'caption') {
        for (const token of field.text.split(/[\s,，、。.!！?？:：;；()（）[\]【】「」『』/／\\|·~～—_-]+/)) {
          const clean = token.trim()
          if (clean.length >= 2 && clean.length <= 14) words.add(clean)
        }
      }
    }
  }
  return [...words]
}

function suggestKeywords(docs: SearchDoc[], keywords: string[], limit = 5): string[] {
  const vocabulary = vocabularyOf(docs)
  const suggestions: { word: string; distance: number }[] = []
  const seen = new Set(keywords.map((keyword) => normalizeSearchText(keyword)))

  for (const keyword of keywords) {
    const needle = normalizeSearchText(keyword)
    const max = Math.max(1, Math.round(needle.length * 0.34))
    for (const word of vocabulary) {
      const candidate = normalizeSearchText(word)
      if (!candidate || seen.has(candidate)) continue
      if (Math.abs(candidate.length - needle.length) > max + 1) continue
      const distance = editDistance(needle, candidate, max)
      if (distance > max) continue
      suggestions.push({ word, distance })
    }
  }

  suggestions.sort((a, b) => a.distance - b.distance || b.word.length - a.word.length)
  const result: string[] = []
  for (const item of suggestions) {
    const key = normalizeSearchText(item.word)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item.word)
    if (result.length >= limit) break
  }
  return result
}

export interface SearchOptions {
  /** 至少命中的关键词数，默认全部关键词（AND） */
  minMatched?: number
  limit?: number
}

/** 执行搜索；keywords 全量命中才返回，除非显式放宽 minMatched */
export function searchDocs(docs: SearchDoc[], rawQuery: string, options: SearchOptions = {}): SearchResult {
  const keywords = parseKeywords(rawQuery)
  if (!keywords.length) {
    return { hits: [], keywords, missed: [], suggestions: [], partialCount: 0 }
  }

  const minMatched = Math.min(options.minMatched ?? keywords.length, keywords.length)
  const hits: SearchHit[] = []
  const matchedKeywords = new Set<string>()
  let partialCount = 0

  for (const doc of docs) {
    const result = scoreDoc(doc, keywords)
    for (const index of result.matchedIndexes) {
      matchedKeywords.add(normalizeSearchText(keywords[index]))
    }
    if (result.matched >= minMatched) {
      hits.push({ item: doc.item, score: result.score, matches: result.matches })
    }
    if (result.matched > 0 && result.matched < keywords.length) partialCount += 1
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.matches.length - a.matches.length ||
      (b.item.publishedAt > a.item.publishedAt ? 1 : b.item.publishedAt < a.item.publishedAt ? -1 : 0) ||
      a.item.postIndex - b.item.postIndex,
  )

  const missed = keywords.filter((keyword) => !matchedKeywords.has(normalizeSearchText(keyword)))
  const suggestions = hits.length ? [] : suggestKeywords(docs, keywords)

  return {
    hits: options.limit ? hits.slice(0, options.limit) : hits,
    keywords,
    missed,
    suggestions,
    partialCount,
  }
}

/** 把命中区间切成可渲染片段；区间需按起点排序且不重叠 */
export function splitHighlight(text: string, ranges: [number, number][]): { text: string; hit: boolean }[] {
  if (!ranges.length) return [{ text, hit: false }]
  const merged: [number, number][] = []
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  const parts: { text: string; hit: boolean }[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    const from = Math.max(0, Math.min(text.length, start))
    const to = Math.max(from, Math.min(text.length, end))
    if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false })
    if (to > from) parts.push({ text: text.slice(from, to), hit: true })
    cursor = to
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return parts
}

export interface Snippet {
  prefix: boolean
  suffix: boolean
  parts: { text: string; hit: boolean }[]
}

/** 围绕首个命中截取一段上下文，供结果列表展示 */
export function buildSnippet(match: SearchMatch, max = 96): Snippet {
  const { text, ranges } = match
  if (!ranges.length) {
    const clipped = text.length > max
    return {
      prefix: false,
      suffix: clipped,
      parts: [{ text: clipped ? text.slice(0, max) : text, hit: false }],
    }
  }

  const [firstStart, firstEnd] = ranges[0]
  const context = Math.max(18, Math.floor((max - (firstEnd - firstStart)) / 2))
  let start = Math.max(0, firstStart - context)
  const end = Math.min(text.length, start + max)
  if (end - start < max) start = Math.max(0, end - max)

  const shifted = ranges
    .filter(([from, to]) => to > start && from < end)
    .map(([from, to]) => [Math.max(from, start) - start, Math.min(to, end) - start] as [number, number])

  return {
    prefix: start > 0,
    suffix: end < text.length,
    parts: splitHighlight(text.slice(start, end), shifted),
  }
}

const RECENT_KEY = 'namori.search.recent'
const RECENT_LIMIT = 8

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

/** 记录一次完整提交（回车 / 点选结果），输入过程中的半成品不记录 */
export function rememberSearch(query: string): string[] {
  const value = query.trim()
  const current = loadRecentSearches()
  if (!value) return current
  const next = [value, ...current.filter((item) => normalizeSearchText(item) !== normalizeSearchText(value))].slice(
    0,
    RECENT_LIMIT,
  )
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式下写入失败不影响搜索
  }
  return next
}

export function clearRecentSearches(): string[] {
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {
    // 忽略
  }
  return []
}
