import { BUILTIN_DIMENSIONS, CHARACTER_PRESETS, EXTRA_DIMENSIONS, defaultCharacterTags } from './constants'
import type { Character, Dimension, ItemAnnotation, Storyline, Tag, Translation, UserData } from '../types'
import { IS_PUBLIC } from './appMode'

export const STORAGE_KEY = 'namori.diary.userdata.v2'
export const THEME_KEY = 'namori.theme'
/** 本地缓存解析失败时保留的原始字符串，供用户下载排查或抢救 */
export const CORRUPT_BACKUP_KEY = 'namori.diary.userdata.corrupt.v1'

export type StorageIssue = 'quota' | 'corrupt' | 'unavailable'

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: Exclude<StorageIssue, 'corrupt'>; bytes: number }

export interface LocalLoadResult {
  data: UserData | null
  issue: StorageIssue | null
}

/** 2026-11 按需求下线的角色（无任何作品出场），加载本地数据时一并清掉旧记录 */
const RETIRED_CHARACTER_IDS: ReadonlySet<string> = new Set([
  'char_miwa_ai',
  'char_yaeno_miho',
  'char_sonokawa_megumi',
  'char_ogawa_kokoro',
  'char_souma_mirai',
  'char_takasaki_misaki',
])

/** 旧的硬编码角色名 → 现行定义名：保留 id 与已有标注，载入时就地迁移 */
const LEGACY_CHARACTER_NAMES: Readonly<Record<string, readonly string[]>> = {
  char_nishigaki_nana: ['西垣奈奈', '老师们'],
}

/** 2026-11 新增的角色：旧本地数据缺少标签时自动补齐，保证图鉴与标注页顺序一致 */
const ADDED_PRESET_CHARACTER_IDS: ReadonlySet<string> = new Set([
  'char_toushi_hoko',
  'char_kitamiya_hatsumi',
  'char_minamino_tsubasa',
])

function renameLegacyCharacters(data: UserData): UserData {
  let changed = false
  const tags = data.tags.map((tag) => {
    if (!LEGACY_CHARACTER_NAMES[tag.id]?.includes(tag.name)) return tag
    const nextName = CHARACTER_PRESETS.find((preset) => preset.id === tag.id)?.name
    if (!nextName || nextName === tag.name) return tag
    changed = true
    return { ...tag, name: nextName }
  })
  return changed ? { ...data, tags } : data
}

function dropRetiredCharacters(data: UserData): UserData {
  if (!data.tags.some((tag) => RETIRED_CHARACTER_IDS.has(tag.id))) return data
  const keep = (tagId: string) => !RETIRED_CHARACTER_IDS.has(tagId)
  return {
    ...data,
    tags: data.tags.filter((tag) => keep(tag.id)),
    characters: data.characters.filter((character) => keep(character.id)),
    storylines: data.storylines.map((storyline) =>
      storyline.tags.some((tagId) => RETIRED_CHARACTER_IDS.has(tagId))
        ? { ...storyline, tags: storyline.tags.filter(keep) }
        : storyline,
    ),
    items: Object.fromEntries(
      Object.entries(data.items).map(([id, annotation]) =>
        annotation.tags.some((tagId) => RETIRED_CHARACTER_IDS.has(tagId))
          ? [id, { ...annotation, tags: annotation.tags.filter(keep) }]
          : [id, annotation],
      ),
    ),
  }
}

export function emptyAnnotation(): ItemAnnotation {
  return { tags: [], favorite: false, reviewed: false, excluded: false, note: '', updatedAt: new Date(0).toISOString() }
}

export function defaultDimensions(): Dimension[] {
  return [...BUILTIN_DIMENSIONS, ...EXTRA_DIMENSIONS].map((d) => ({ ...d }))
}

export function emptyUserData(includeCharacters = true, datasetId?: string): UserData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    datasetId,
    dimensions: defaultDimensions(),
    tags: includeCharacters ? defaultCharacterTags() : [],
    characters: [],
    collections: [],
    storylines: [],
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

  // 补上新增三位老师的标签（已存在则保持用户数据原样）
  for (const preset of CHARACTER_PRESETS) {
    if (!ADDED_PRESET_CHARACTER_IDS.has(preset.id) || tags.some((tag) => tag.id === preset.id)) continue
    tags.push({
      id: preset.id,
      name: preset.name,
      dimensionId: 'character',
      color: preset.color,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
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

  const characters: Character[] = []
  if (Array.isArray(data.characters)) {
    for (const c of data.characters) {
      if (!c || !c.id || characters.some((x) => x.id === c.id)) continue
      if (!tagIds.has(c.id)) continue
      const character: Character = { id: c.id, createdAt: str(c.createdAt, new Date().toISOString()) }
      if (typeof c.avatarItemId === 'string') character.avatarItemId = c.avatarItemId
      if (typeof c.avatarDataUrl === 'string') character.avatarDataUrl = c.avatarDataUrl
      if (typeof c.avatar === 'string') character.avatar = c.avatar
      if (typeof c.avatarSource === 'string') character.avatarSource = c.avatarSource
      if (typeof c.coverItemId === 'string') character.coverItemId = c.coverItemId
      if (c.profile && typeof c.profile === 'object') {
        character.profile = {
          cv: str(c.profile.cv),
          role: str(c.profile.role),
          traits: str(c.profile.traits),
        }
      }
      if (c.coverCrop && typeof c.coverCrop === 'object') {
        const x = Number(c.coverCrop.x)
        const y = Number(c.coverCrop.y)
        const zoom = Number(c.coverCrop.zoom)
        if (Number.isFinite(x) && Number.isFinite(y)) {
          character.coverCrop = {
            x: Math.min(100, Math.max(0, x)),
            y: Math.min(100, Math.max(0, y)),
            zoom: Number.isFinite(zoom) ? Math.min(4, Math.max(1, zoom)) : 1,
          }
        }
      }
      if (typeof c.note === 'string') character.note = c.note
      if (c.avatarCrop && typeof c.avatarCrop === 'object') {
        character.avatarCrop = {
          cx: Number(c.avatarCrop.cx ?? 0.5),
          cy: Number(c.avatarCrop.cy ?? 0.5),
          size: Number(c.avatarCrop.size ?? 1),
          tolerance: Number(c.avatarCrop.tolerance ?? 18),
          transparent: c.avatarCrop.transparent !== false,
        }
      }
      characters.push(character)
    }
  }

  const storylines: Storyline[] = []
  if (Array.isArray(data.storylines)) {
    for (const s of data.storylines) {
      if (!s || !s.id || !s.title) continue
      if (storylines.some((x) => x.id === s.id)) continue
      const blocks = Array.isArray(s.blocks)
        ? s.blocks
            .filter((b) => b && b.id && (b.type === 'image' || b.type === 'note'))
            .map((b) => ({
              id: b.id,
              type: b.type,
              itemId: b.type === 'image' ? str(b.itemId) : undefined,
              text: b.type === 'note' ? str(b.text) : undefined,
            }))
            .filter((b) => (b.type === 'image' ? Boolean(b.itemId) : Boolean((b.text ?? '').trim())))
        : []
      storylines.push({
        id: s.id,
        title: str(s.title, '未命名故事线'),
        description: str(s.description),
        coverItemId: s.coverItemId ? str(s.coverItemId) : undefined,
        blocks,
        tags: Array.isArray(s.tags) ? [...new Set(s.tags.filter((t) => typeof t === 'string'))] : [],
        published: Boolean(s.published),
        createdAt: str(s.createdAt, new Date().toISOString()),
        updatedAt: str(s.updatedAt, new Date().toISOString()),
      })
    }
  }

  const items: Record<string, ItemAnnotation> = {}
  if (data.items && typeof data.items === 'object') {
    for (const [id, value] of Object.entries(data.items)) {
      if (!value || typeof value !== 'object') continue
      const a = value as Partial<ItemAnnotation>
      const ann: ItemAnnotation = {
        tags: Array.isArray(a.tags) ? [...new Set(a.tags.filter((t) => tagIds.has(t)))] : [],
        favorite: Boolean(a.favorite),
        reviewed: Boolean(a.reviewed || a.excluded),
        excluded: Boolean(a.excluded),
        deleted: Boolean(a.deleted),
        note: str(a.note),
        updatedAt: str(a.updatedAt, new Date().toISOString()),
      }
      if (a.deletedAt) ann.deletedAt = str(a.deletedAt)
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
      const xiaohongshu = str(a.xiaohongshu).trim()
      if (xiaohongshu) ann.xiaohongshu = xiaohongshu
      const wechat = str(a.wechat).trim()
      if (wechat) ann.wechat = wechat
      const translation = normalizeTranslation(a.translation)
      if (translation) ann.translation = translation
      items[id] = ann
    }
  }

  return renameLegacyCharacters(
    dropRetiredCharacters({
      version: 2,
      updatedAt: str(data.updatedAt, new Date().toISOString()),
      datasetId: typeof data.datasetId === 'string' ? data.datasetId : undefined,
      dimensions,
      tags,
      characters,
      collections,
      storylines,
      items,
    }),
  )
}

function normalizeTranslation(raw: unknown): Translation | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Translation>
  const slots = Array.isArray(value.slots)
    ? value.slots
        .filter((s) => s && typeof s.lang === 'string')
        .map((s) => ({
          lang: str(s.lang),
          label: str(s.label, s.lang),
          text: str(s.text),
        }))
    : []
  const source = str(value.source)
  const sourceDraft = typeof value.sourceDraft === 'string' ? value.sourceDraft : undefined
  if (!source && !slots.some((s) => s.text) && !sourceDraft) return null
  return {
    source,
    sourceDraft,
    slots,
    updatedAt: str(value.updatedAt, new Date().toISOString()),
  }
}

/** 一次性恢复默认封面：清空所有角色的封面来源与焦点，保留头像、简介与标注 */
const COVER_RESET_MARKER = 'namori.covers.reset.v1'

function clearCoverOverridesOnce(data: UserData): UserData {
  try {
    if (localStorage.getItem(COVER_RESET_MARKER)) return data
  } catch {
    return data
  }
  const hasOverrides = data.characters.some((character) => character.coverItemId || character.coverCrop)
  if (!hasOverrides) {
    try {
      localStorage.setItem(COVER_RESET_MARKER, '1')
    } catch {
      // 忽略隐私模式下的写入失败
    }
    return data
  }
  const next: UserData = {
    ...data,
    characters: data.characters.map((character) => {
      const cleaned = { ...character }
      delete cleaned.coverItemId
      delete cleaned.coverCrop
      return cleaned
    }),
  }
  try {
    // 同时落盘，避免 React 重复执行初始化时又读到旧的封面参数
    localStorage.setItem(COVER_RESET_MARKER, '1')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 忽略隐私模式下的写入失败
  }
  return next
}

function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014
    )
  }
  return err instanceof Error && /quota/i.test(err.name)
}

export function loadLocalUserData(): LocalLoadResult {
  // 公开端始终使用构建时的发布数据，避免旧 localStorage 缓存盖住新发布的封面与标注
  if (IS_PUBLIC) return { data: null, issue: null }
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('本地存储无法读取（可能被浏览器禁用）', err)
    return { data: null, issue: 'unavailable' }
  }
  if (!raw) return { data: null, issue: null }
  try {
    return { data: clearCoverOverridesOnce(normalizeUserData(JSON.parse(raw))), issue: null }
  } catch (err) {
    // 解析失败绝不静默重置：先把原始字符串备份到独立 key，再交给界面提示
    console.error('本地标注缓存损坏，已保留原始副本', err)
    try {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      // 备份也写不进去时至少留下原始内容，便于从控制台抢救
      console.error('[namori] corrupt userdata raw:', raw)
    }
    return { data: null, issue: 'corrupt' }
  }
}

/** 读取损坏缓存的原始副本，用于导出抢救 */
export function loadCorruptBackup(): string | null {
  try {
    return localStorage.getItem(CORRUPT_BACKUP_KEY)
  } catch {
    return null
  }
}

export function saveLocalUserData(data: UserData): SaveResult {
  // 公开端只读：发布数据由构建产物提供，不写入浏览器缓存
  if (IS_PUBLIC) return { ok: true }
  let json: string
  try {
    json = JSON.stringify(data)
  } catch (err) {
    console.warn('本地标注序列化失败', err)
    return { ok: false, reason: 'unavailable', bytes: 0 }
  }
  try {
    localStorage.setItem(STORAGE_KEY, json)
    return { ok: true }
  } catch (err) {
    const reason = isQuotaError(err) ? 'quota' : 'unavailable'
    console.warn(`本地标注保存失败（${reason}），本次修改未写入浏览器存储`, err)
    return { ok: false, reason, bytes: json.length }
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

  const characters = [...current.characters]
  for (const character of incoming.characters) {
    const existing = characters.find((c) => c.id === character.id)
    if (!existing) characters.push(character)
    else Object.assign(existing, character)
  }

  const storylines = [...current.storylines]
  for (const storyline of incoming.storylines) {
    const existing = storylines.find((s) => s.id === storyline.id)
    if (!existing) storylines.push(storyline)
    else Object.assign(existing, storyline, { tags: [...new Set([...existing.tags, ...storyline.tags])] })
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
      reviewed: existing.reviewed || ann.reviewed || existing.excluded || ann.excluded,
      excluded: existing.excluded || ann.excluded,
      deleted: Boolean(existing.deleted || ann.deleted),
      deletedAt: ann.deletedAt ?? existing.deletedAt,
      note: ann.note || existing.note,
      translation: ann.translation ?? existing.translation,
      date: ann.date ?? existing.date,
      study: ann.study ?? existing.study,
      crop: ann.crop ?? existing.crop,
      xiaohongshu: ann.xiaohongshu || existing.xiaohongshu,
      wechat: ann.wechat || existing.wechat,
    }
  }

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    datasetId: current.datasetId,
    dimensions,
    tags,
    characters,
    collections,
    storylines,
    items,
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
}

export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type }), filename)
}

export function annotationCount(data: UserData): number {
  return Object.values(data.items).filter(
    (a) =>
      a.tags.length > 0 ||
      a.favorite ||
      a.reviewed ||
      a.excluded ||
      a.note ||
      a.translation ||
      a.date ||
      a.study ||
      a.crop ||
      a.xiaohongshu ||
      a.wechat,
  ).length
}
