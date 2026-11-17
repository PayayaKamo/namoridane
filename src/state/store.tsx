import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Character,
  Collection,
  DateOverride,
  DiaryItem,
  DiaryReviewStatus,
  Dimension,
  EffectiveDate,
  ItemAnnotation,
  LibraryIndex,
  ReviewExportFile,
  Storyline,
  StorylineBlock,
  StudyNotes,
  Tag,
  Translation,
  TranslationSlot,
  UserData,
} from '../types'
import { effectiveDate, isValidYmd, publishedDate, suggestedDate } from '../lib/dates'
import { defaultCharacterTags } from '../lib/constants'
import {
  THEME_KEY,
  emptyAnnotation,
  emptyUserData,
  loadLocalUserData,
  loadSeedUserData,
  mergeUserData,
  normalizeUserData,
  saveLocalUserData,
} from '../lib/storage'
import { uid } from '../lib/utils'
import type { CropParams } from '../types'

type Theme = 'light' | 'dark'
type Tone = 'default' | 'success' | 'error'

interface Toast {
  id: string
  text: string
  tone: Tone
}

interface StoreValue {
  index: LibraryIndex | null
  items: DiaryItem[]
  allItems: DiaryItem[]
  excludedItems: DiaryItem[]
  deletedItems: DiaryItem[]
  lastDeletion: string[] | null
  confirmedDiaryItems: DiaryItem[]
  pendingReviewItems: DiaryItem[]
  itemMap: Map<string, DiaryItem>
  loading: boolean
  error: string | null
  data: UserData
  annotations: Record<string, ItemAnnotation>
  tags: Tag[]
  tagMap: Map<string, Tag>
  tagUsage: Record<string, number>
  dimensions: Dimension[]
  collections: Collection[]
  characters: Character[]
  storylines: Storyline[]
  years: string[]
  theme: Theme
  toasts: Toast[]
  notify: (text: string, tone?: Tone) => void
  dismissToast: (id: string) => void
  toggleTheme: () => void
  getDate: (item: DiaryItem) => EffectiveDate
  getAnnotation: (id: string) => ItemAnnotation | undefined
  setItemTags: (id: string, tagIds: string[]) => void
  toggleTagOnItem: (id: string, tagId: string) => void
  toggleFavorite: (ids: string[]) => void
  setFavorite: (ids: string[], value: boolean) => void
  setExcluded: (ids: string[], value: boolean) => void
  setReviewStatus: (ids: string[], status: DiaryReviewStatus) => void
  setNote: (id: string, note: string) => void
  setStudy: (id: string, patch: Partial<StudyNotes>) => void
  setCrop: (id: string, crop: CropParams) => void
  setDateOverride: (id: string, date: DateOverride | null) => void
  confirmDate: (ids: string[], kind: 'published' | 'suggested') => void
  setManualDate: (id: string, year: number, month: number, day: number) => void
  addTag: (name: string, dimensionId: string, color: string) => Tag
  addCharacterPresets: () => void
  addCharacter: (name: string, color: string) => Tag
  updateCharacter: (id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>) => void
  setTranslation: (id: string, translation: Translation | null) => void
  deleteItems: (ids: string[]) => void
  restoreDeleted: (ids: string[]) => void
  clearDeletedRecords: (ids: string[]) => void
  undoDelete: () => void
  importTranslations: (
    rows: { id: string; source: string; sourceDraft?: string; slots: TranslationSlot[] }[],
  ) => number
  addStoryline: (title?: string, itemIds?: string[]) => Storyline
  updateStoryline: (
    id: string,
    patch: Partial<Pick<Storyline, 'title' | 'description' | 'coverItemId' | 'tags' | 'published'>>,
  ) => void
  deleteStoryline: (id: string) => void
  addToStoryline: (id: string, itemIds: string[]) => void
  removeStorylineBlock: (id: string, blockId: string) => void
  reorderStorylineBlocks: (id: string, blocks: StorylineBlock[]) => void
  addStorylineNote: (id: string, text: string, afterBlockId?: string) => void
  updateTag: (id: string, patch: Partial<Pick<Tag, 'name' | 'color' | 'dimensionId'>>) => void
  deleteTag: (id: string) => void
  addTagToItems: (ids: string[], tagId: string) => void
  removeTagFromItems: (ids: string[], tagId: string) => void
  addDimension: (name: string) => Dimension
  renameDimension: (id: string, name: string) => void
  deleteDimension: (id: string) => void
  addCollection: (name: string, description?: string) => Collection
  updateCollection: (id: string, patch: Partial<Pick<Collection, 'name' | 'description' | 'coverItemId'>>) => void
  deleteCollection: (id: string) => void
  addToCollection: (collectionId: string, itemIds: string[]) => void
  removeFromCollection: (collectionId: string, itemIds: string[]) => void
  reorderCollection: (collectionId: string, itemIds: string[]) => void
  importData: (raw: unknown, mode: 'merge' | 'replace') => void
  importReview: (file: ReviewExportFile) => number
  loadSeed: () => Promise<void>
  resetData: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}

function currentTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<LibraryIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<UserData>(() => loadLocalUserData() ?? emptyUserData())
  const [lastDeletion, setLastDeletion] = useState<string[] | null>(null)
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const [toasts, setToasts] = useState<Toast[]>([])

  // 加载索引
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/index.json`, { signal: controller.signal, cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<LibraryIndex>
      })
      .then((json) => {
        setIndex(json)
        setData((prev) => {
          // 标注与数据集版本绑定：版本不一致时整份作废，避免出现指向不存在图片的死记录
          if (!json.datasetId || prev.datasetId === json.datasetId) {
            return json.datasetId && !prev.datasetId ? { ...prev, datasetId: json.datasetId } : prev
          }
          const next = emptyUserData(true, json.datasetId)
          saveLocalUserData(next)
          return next
        })
        setLoading(false)
        if (!json.datasetId) return
        // 数据集变化或首次访问时，尝试载入仓库种子（公开站的标注来源）
        loadSeedUserData().then((seed) => {
          if (!seed) return
          const hasContent =
            seed.tags.length > 0 || seed.collections.length > 0 || Object.keys(seed.items).length > 0
          if (!hasContent) return
          seed.datasetId = json.datasetId
          setData((prev) => {
            if (prev.datasetId !== json.datasetId || Object.keys(prev.items).length > 0) return prev
            saveLocalUserData(seed)
            return seed
          })
        })
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  // 自动保存（防抖）
  useEffect(() => {
    const timer = setTimeout(() => saveLocalUserData(data), 250)
    return () => clearTimeout(timer)
  }, [data])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const notify = useCallback((text: string, tone: Tone = 'default') => {
    const id = uid('t')
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const mutate = useCallback((fn: (prev: UserData) => UserData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }))
  }, [])

  const patchItem = useCallback(
    (id: string, updater: (ann: ItemAnnotation) => ItemAnnotation) => {
      mutate((prev) => {
        const current = prev.items[id] ?? emptyAnnotation()
        return {
          ...prev,
          items: {
            ...prev.items,
            [id]: { ...updater(current), updatedAt: new Date().toISOString() },
          },
        }
      })
    },
    [mutate],
  )

  const batchPatch = useCallback(
    (ids: string[], updater: (ann: ItemAnnotation) => ItemAnnotation) => {
      mutate((prev) => {
        const now = new Date().toISOString()
        const items = { ...prev.items }
        for (const id of ids) {
          const current = items[id] ?? emptyAnnotation()
          items[id] = { ...updater(current), updatedAt: now }
        }
        return { ...prev, items }
      })
    },
    [mutate],
  )

  const allItems = useMemo(() => index?.items ?? [], [index])
  const items = useMemo(
    () => allItems.filter((item) => !data.items[item.id]?.excluded && !data.items[item.id]?.deleted),
    [allItems, data.items],
  )
  const excludedItems = useMemo(
    () => allItems.filter((item) => data.items[item.id]?.excluded && !data.items[item.id]?.deleted),
    [allItems, data.items],
  )
  const deletedItems = useMemo(
    () => allItems.filter((item) => data.items[item.id]?.deleted),
    [allItems, data.items],
  )
  const confirmedDiaryItems = useMemo(
    () =>
      allItems.filter(
        (item) => data.items[item.id]?.reviewed && !data.items[item.id]?.excluded && !data.items[item.id]?.deleted,
      ),
    [allItems, data.items],
  )
  const pendingReviewItems = useMemo(
    () =>
      allItems.filter(
        (item) => !data.items[item.id]?.reviewed && !data.items[item.id]?.excluded && !data.items[item.id]?.deleted,
      ),
    [allItems, data.items],
  )

  const itemMap = useMemo(() => {
    const map = new Map<string, DiaryItem>()
    for (const item of allItems) map.set(item.id, item)
    return map
  }, [allItems])

  const years = useMemo(() => {
    if (!index) return []
    return Object.keys(index.years).sort()
  }, [index])

  const tagMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t])), [data.tags])

  const tagUsage = useMemo(() => {
    const usage: Record<string, number> = {}
    for (const ann of Object.values(data.items)) {
      if (ann.excluded) continue
      for (const tagId of ann.tags) usage[tagId] = (usage[tagId] ?? 0) + 1
    }
    return usage
  }, [data.items])

  const getAnnotation = useCallback((id: string) => data.items[id], [data.items])
  const getDate = useCallback((item: DiaryItem) => effectiveDate(item, data.items[item.id]), [data.items])

  const setItemTags = useCallback(
    (id: string, tagIds: string[]) => patchItem(id, (a) => ({ ...a, tags: [...new Set(tagIds)] })),
    [patchItem],
  )

  const toggleTagOnItem = useCallback(
    (id: string, tagId: string) =>
      patchItem(id, (a) => ({
        ...a,
        tags: a.tags.includes(tagId) ? a.tags.filter((t) => t !== tagId) : [...a.tags, tagId],
      })),
    [patchItem],
  )

  const setFavorite = useCallback(
    (ids: string[], value: boolean) => batchPatch(ids, (a) => ({ ...a, favorite: value })),
    [batchPatch],
  )

  const setReviewStatus = useCallback(
    (ids: string[], status: DiaryReviewStatus) =>
      batchPatch(ids, (a) => ({
        ...a,
        reviewed: status !== 'pending',
        excluded: status === 'not_diary',
      })),
    [batchPatch],
  )

  const setExcluded = useCallback(
    (ids: string[], value: boolean) => setReviewStatus(ids, value ? 'not_diary' : 'diary'),
    [setReviewStatus],
  )

  const toggleFavorite = useCallback(
    (ids: string[]) =>
      batchPatch(ids, (a) => ({ ...a, favorite: !a.favorite })),
    [batchPatch],
  )

  const setNote = useCallback(
    (id: string, note: string) => patchItem(id, (a) => ({ ...a, note })),
    [patchItem],
  )

  const setStudy = useCallback(
    (id: string, patch: Partial<StudyNotes>) =>
      patchItem(id, (a) => ({
        ...a,
        study: {
          composition: '',
          palette: '',
          linework: '',
          expression: '',
          memo: '',
          ...(a.study ?? {}),
          ...patch,
        },
      })),
    [patchItem],
  )

  const setCrop = useCallback(
    (id: string, crop: CropParams) => patchItem(id, (a) => ({ ...a, crop })),
    [patchItem],
  )

  const setDateOverride = useCallback(
    (id: string, date: DateOverride | null) =>
      patchItem(id, (a) => {
        const next = { ...a }
        if (date) next.date = date
        else delete next.date
        return next
      }),
    [patchItem],
  )

  const confirmDate = useCallback(
    (ids: string[], kind: 'published' | 'suggested') => {
      mutate((prev) => {
        const items = { ...prev.items }
        const now = new Date().toISOString()
        for (const id of ids) {
          const item = itemMap.get(id)
          if (!item) continue
          const current = items[id] ?? emptyAnnotation()
          const date = kind === 'published' ? publishedDate(item) : { ...suggestedDate(item), confirmed: true }
          items[id] = { ...current, date, updatedAt: now }
        }
        return { ...prev, items }
      })
    },
    [itemMap, mutate],
  )

  const setManualDate = useCallback(
    (id: string, year: number, month: number, day: number) => {
      if (!isValidYmd(year, month, day)) return
      patchItem(id, (a) => ({
        ...a,
        date: { year, month, day, confirmed: true, source: 'manual' },
      }))
    },
    [patchItem],
  )

  const addTag = useCallback(
    (name: string, dimensionId: string, color: string) => {
      const tag: Tag = {
        id: uid('tag_'),
        name: name.trim(),
        dimensionId,
        color,
        createdAt: new Date().toISOString(),
      }
      mutate((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
      return tag
    },
    [mutate],
  )

  const addCharacterPresets = useCallback(() => {
    mutate((prev) => {
      const existing = new Set(
        prev.tags.filter((tag) => tag.dimensionId === 'character').map((tag) => tag.name),
      )
      const additions = defaultCharacterTags().filter((tag) => !existing.has(tag.name))
      return additions.length ? { ...prev, tags: [...prev.tags, ...additions] } : prev
    })
  }, [mutate])

  const addCharacter = useCallback(
    (name: string, color: string) => {
      const tag: Tag = {
        id: uid('tag_'),
        name: name.trim() || '新角色',
        dimensionId: 'character',
        color,
        createdAt: new Date().toISOString(),
      }
      const character: Character = { id: tag.id, createdAt: new Date().toISOString() }
      mutate((prev) => ({ ...prev, tags: [...prev.tags, tag], characters: [...prev.characters, character] }))
      return tag
    },
    [mutate],
  )

  const updateCharacter = useCallback(
    (id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>) => {
      mutate((prev) => {
        const exists = prev.characters.some((c) => c.id === id)
        if (!exists) {
          const character: Character = { id, createdAt: new Date().toISOString(), ...patch }
          return { ...prev, characters: [...prev.characters, character] }
        }
        return {
          ...prev,
          characters: prev.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }
      })
    },
    [mutate],
  )

  const updateTag = useCallback(
    (id: string, patch: Partial<Pick<Tag, 'name' | 'color' | 'dimensionId'>>) => {
      mutate((prev) => ({
        ...prev,
        tags: prev.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
    },
    [mutate],
  )

  const deleteTag = useCallback(
    (id: string) => {
      mutate((prev) => {
        const items: Record<string, ItemAnnotation> = {}
        for (const [key, ann] of Object.entries(prev.items)) {
          items[key] = ann.tags.includes(id) ? { ...ann, tags: ann.tags.filter((t) => t !== id) } : ann
        }
        return {
          ...prev,
          tags: prev.tags.filter((t) => t.id !== id),
          characters: prev.characters.filter((c) => c.id !== id),
          items,
        }
      })
    },
    [mutate],
  )

  const setTranslation = useCallback(
    (id: string, translation: Translation | null) =>
      patchItem(id, (a) => {
        const next = { ...a }
        if (translation) next.translation = { ...translation, updatedAt: new Date().toISOString() }
        else delete next.translation
        return next
      }),
    [patchItem],
  )

  /** 删除：立即从所有视图隐藏，等待本地清理原图 */
  const deleteItems = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString()
      mutate((prev) => {
        const items = { ...prev.items }
        for (const id of ids) {
          const current = items[id] ?? emptyAnnotation()
          items[id] = { ...current, deleted: true, deletedAt: now, updatedAt: now }
        }
        return { ...prev, items }
      })
      setLastDeletion(ids)
    },
    [mutate],
  )

  const restoreDeleted = useCallback(
    (ids: string[]) => {
      mutate((prev) => {
        const items = { ...prev.items }
        for (const id of ids) {
          const current = items[id]
          if (!current) continue
          const next = { ...current, deleted: false, updatedAt: new Date().toISOString() }
          delete next.deletedAt
          items[id] = next
        }
        return { ...prev, items }
      })
      setLastDeletion(null)
    },
    [mutate],
  )

  /** 原图彻底清理后，移除悬浮的标注记录，避免指向不存在文件 */
  const clearDeletedRecords = useCallback(
    (ids: string[]) => {
      mutate((prev) => {
        const items = { ...prev.items }
        for (const id of ids) delete items[id]
        return { ...prev, items }
      })
      setLastDeletion(null)
    },
    [mutate],
  )

  const undoDelete = useCallback(() => {
    if (lastDeletion) restoreDeleted(lastDeletion)
  }, [lastDeletion, restoreDeleted])

  /** 批量回填翻译（CSV / JSON），只更新翻译字段，保留标签、日期等标注 */
  const importTranslations = useCallback(
    (rows: { id: string; source: string; sourceDraft?: string; slots: TranslationSlot[] }[]) => {
      const valid = rows.filter((row) => itemMap.has(row.id))
      mutate((prev) => {
        const items = { ...prev.items }
        const now = new Date().toISOString()
        for (const row of valid) {
          const slots = row.slots
            .filter((s) => s && typeof s.lang === 'string')
            .map((s) => ({ lang: s.lang, label: s.label || s.lang, text: s.text || '' }))
          if (!row.source && !row.sourceDraft && !slots.some((s) => s.text.trim())) continue
          const current = items[row.id] ?? emptyAnnotation()
          items[row.id] = {
            ...current,
            translation: {
              source: row.source || '',
              sourceDraft: row.sourceDraft,
              slots,
              updatedAt: now,
            },
            updatedAt: now,
          }
        }
        return { ...prev, items }
      })
      return valid.length
    },
    [itemMap, mutate],
  )

  const addTagToItems = useCallback(
    (ids: string[], tagId: string) =>
      batchPatch(ids, (a) => ({ ...a, tags: a.tags.includes(tagId) ? a.tags : [...a.tags, tagId] })),
    [batchPatch],
  )

  const removeTagFromItems = useCallback(
    (ids: string[], tagId: string) =>
      batchPatch(ids, (a) => ({ ...a, tags: a.tags.filter((t) => t !== tagId) })),
    [batchPatch],
  )

  const addDimension = useCallback(
    (name: string) => {
      const dimension: Dimension = {
        id: uid('dim_'),
        name: name.trim(),
        order: Date.now(),
      }
      mutate((prev) => ({ ...prev, dimensions: [...prev.dimensions, dimension] }))
      return dimension
    },
    [mutate],
  )

  const renameDimension = useCallback(
    (id: string, name: string) => {
      mutate((prev) => ({
        ...prev,
        dimensions: prev.dimensions.map((d) => (d.id === id ? { ...d, name } : d)),
      }))
    },
    [mutate],
  )

  const deleteDimension = useCallback(
    (id: string) => {
      mutate((prev) => {
        const fallback = prev.dimensions.find((d) => d.id === 'custom')?.id ?? 'custom'
        return {
          ...prev,
          dimensions: prev.dimensions.filter((d) => d.id !== id),
          tags: prev.tags.map((t) => (t.dimensionId === id ? { ...t, dimensionId: fallback } : t)),
        }
      })
    },
    [mutate],
  )

  const addCollection = useCallback(
    (name: string, description = '') => {
      const now = new Date().toISOString()
      const collection: Collection = {
        id: uid('col_'),
        name: name.trim() || '未命名合集',
        description,
        itemIds: [],
        createdAt: now,
        updatedAt: now,
      }
      mutate((prev) => ({ ...prev, collections: [...prev.collections, collection] }))
      return collection
    },
    [mutate],
  )

  const updateCollection = useCallback(
    (id: string, patch: Partial<Pick<Collection, 'name' | 'description' | 'coverItemId'>>) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
        ),
      }))
    },
    [mutate],
  )

  const deleteCollection = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, collections: prev.collections.filter((c) => c.id !== id) }))
    },
    [mutate],
  )

  const addToCollection = useCallback(
    (collectionId: string, itemIds: string[]) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                itemIds: [...new Set([...c.itemIds, ...itemIds])],
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      }))
    },
    [mutate],
  )

  const removeFromCollection = useCallback(
    (collectionId: string, itemIds: string[]) => {
      const set = new Set(itemIds)
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId
            ? { ...c, itemIds: c.itemIds.filter((id) => !set.has(id)), updatedAt: new Date().toISOString() }
            : c,
        ),
      }))
    },
    [mutate],
  )

  const reorderCollection = useCallback(
    (collectionId: string, itemIds: string[]) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId ? { ...c, itemIds, updatedAt: new Date().toISOString() } : c,
        ),
      }))
    },
    [mutate],
  )

  const addStoryline = useCallback(
    (title = '未命名故事线', itemIds: string[] = []) => {
      const now = new Date().toISOString()
      const storyline: Storyline = {
        id: uid('story_'),
        title: title.trim() || '未命名故事线',
        description: '',
        blocks: itemIds.map((itemId) => ({ id: uid('block_'), type: 'image' as const, itemId })),
        tags: [],
        createdAt: now,
        updatedAt: now,
      }
      mutate((prev) => ({ ...prev, storylines: [...prev.storylines, storyline] }))
      return storyline
    },
    [mutate],
  )

  const updateStoryline = useCallback(
    (id: string, patch: Partial<Pick<Storyline, 'title' | 'description' | 'coverItemId' | 'tags' | 'published'>>) => {
      mutate((prev) => ({
        ...prev,
        storylines: prev.storylines.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
        ),
      }))
    },
    [mutate],
  )

  const deleteStoryline = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, storylines: prev.storylines.filter((s) => s.id !== id) }))
    },
    [mutate],
  )

  const addToStoryline = useCallback(
    (id: string, itemIds: string[]) => {
      mutate((prev) => ({
        ...prev,
        storylines: prev.storylines.map((s) => {
          if (s.id !== id) return s
          const existing = new Set(s.blocks.filter((b) => b.type === 'image').map((b) => b.itemId))
          const additions = itemIds.filter((itemId) => !existing.has(itemId)).map((itemId) => ({
            id: uid('block_'),
            type: 'image' as const,
            itemId,
          }))
          return {
            ...s,
            blocks: [...s.blocks, ...additions],
            coverItemId: s.coverItemId ?? additions[0]?.itemId ?? s.blocks.find((b) => b.type === 'image')?.itemId,
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [mutate],
  )

  const removeStorylineBlock = useCallback(
    (id: string, blockId: string) => {
      mutate((prev) => ({
        ...prev,
        storylines: prev.storylines.map((s) =>
          s.id === id ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId), updatedAt: new Date().toISOString() } : s,
        ),
      }))
    },
    [mutate],
  )

  const reorderStorylineBlocks = useCallback(
    (id: string, blocks: StorylineBlock[]) => {
      mutate((prev) => ({
        ...prev,
        storylines: prev.storylines.map((s) => (s.id === id ? { ...s, blocks, updatedAt: new Date().toISOString() } : s)),
      }))
    },
    [mutate],
  )

  const addStorylineNote = useCallback(
    (id: string, text: string, afterBlockId?: string) => {
      mutate((prev) => ({
        ...prev,
        storylines: prev.storylines.map((s) => {
          if (s.id !== id) return s
          const block: StorylineBlock = { id: uid('block_'), type: 'note', text }
          const at = afterBlockId ? s.blocks.findIndex((b) => b.id === afterBlockId) : -1
          const blocks = [...s.blocks]
          if (at >= 0) blocks.splice(at + 1, 0, block)
          else blocks.push(block)
          return { ...s, blocks, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [mutate],
  )

  const importData = useCallback(
    (raw: unknown, mode: 'merge' | 'replace') => {
      const incoming = normalizeUserData(raw)
      setData((prev) => (mode === 'merge' ? mergeUserData(prev, incoming) : incoming))
    },
    [],
  )

  const importReview = useCallback(
    (file: ReviewExportFile) => {
      const rows = file.items.filter((row) => itemMap.has(row.id))
      mutate((prev) => {
        const items = { ...prev.items }
        const now = new Date().toISOString()
        for (const row of rows) {
          const current = items[row.id] ?? emptyAnnotation()
          const annotation: ItemAnnotation = {
            ...current,
            reviewed: row.status !== 'pending',
            excluded: row.status === 'not_diary',
            updatedAt: now,
          }
          if (row.dateConfirmed) {
            const [year, month, day] = row.diaryDate.split('-').map(Number)
            if (isValidYmd(year, month, day)) {
              annotation.date = {
                year,
                month,
                day,
                confirmed: true,
                source: row.dateSource,
              }
            }
          }
          items[row.id] = annotation
        }
        return { ...prev, items }
      })
      return rows.length
    },
    [itemMap, mutate],
  )

  const loadSeed = useCallback(async () => {
    const seed = await loadSeedUserData()
    if (!seed) {
      notify('没有找到种子数据（public/data/userdata.seed.json）', 'error')
      return
    }
    setData((prev) => mergeUserData(prev, { ...seed, datasetId: index?.datasetId ?? prev.datasetId }))
    notify('已合并仓库种子标注', 'success')
  }, [index?.datasetId, notify])

  const resetData = useCallback(() => {
    setData(emptyUserData(false, index?.datasetId))
    notify('本地标注已清空', 'success')
  }, [index?.datasetId, notify])

  const value = useMemo<StoreValue>(
    () => ({
      index,
      items,
      allItems,
      excludedItems,
      deletedItems,
      lastDeletion,
      confirmedDiaryItems,
      pendingReviewItems,
      itemMap,
      loading,
      error,
      data,
      annotations: data.items,
      tags: data.tags,
      tagMap,
      tagUsage,
      dimensions: [...data.dimensions].sort((a, b) => a.order - b.order),
      collections: data.collections,
      characters: data.characters,
      storylines: data.storylines,
      years,
      theme,
      toasts,
      notify,
      dismissToast,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      getDate,
      getAnnotation,
      setItemTags,
      toggleTagOnItem,
      toggleFavorite,
      setFavorite,
      setExcluded,
      setReviewStatus,
      setNote,
      setStudy,
      setCrop,
      setDateOverride,
      confirmDate,
      setManualDate,
      addTag,
      addCharacterPresets,
      addCharacter,
      updateCharacter,
      setTranslation,
      deleteItems,
      restoreDeleted,
      clearDeletedRecords,
      undoDelete,
      importTranslations,
      addStoryline,
      updateStoryline,
      deleteStoryline,
      addToStoryline,
      removeStorylineBlock,
      reorderStorylineBlocks,
      addStorylineNote,
      updateTag,
      deleteTag,
      addTagToItems,
      removeTagFromItems,
      addDimension,
      renameDimension,
      deleteDimension,
      addCollection,
      updateCollection,
      deleteCollection,
      addToCollection,
      removeFromCollection,
      reorderCollection,
      importData,
      importReview,
      loadSeed,
      resetData,
    }),
    [
      index,
      items,
      allItems,
      excludedItems,
      deletedItems,
      lastDeletion,
      confirmedDiaryItems,
      pendingReviewItems,
      itemMap,
      loading,
      error,
      data,
      tagMap,
      tagUsage,
      years,
      theme,
      toasts,
      notify,
      dismissToast,
      getDate,
      getAnnotation,
      setItemTags,
      toggleTagOnItem,
      toggleFavorite,
      setFavorite,
      setExcluded,
      setReviewStatus,
      setNote,
      setStudy,
      setCrop,
      setDateOverride,
      confirmDate,
      setManualDate,
      addTag,
      addCharacterPresets,
      addCharacter,
      updateCharacter,
      setTranslation,
      deleteItems,
      restoreDeleted,
      clearDeletedRecords,
      undoDelete,
      importTranslations,
      addStoryline,
      updateStoryline,
      deleteStoryline,
      addToStoryline,
      removeStorylineBlock,
      reorderStorylineBlocks,
      addStorylineNote,
      updateTag,
      deleteTag,
      addTagToItems,
      removeTagFromItems,
      addDimension,
      renameDimension,
      deleteDimension,
      addCollection,
      updateCollection,
      deleteCollection,
      addToCollection,
      removeFromCollection,
      reorderCollection,
      importData,
      importReview,
      loadSeed,
      resetData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
