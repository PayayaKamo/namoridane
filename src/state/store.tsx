import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Collection,
  DateOverride,
  DiaryItem,
  Dimension,
  EffectiveDate,
  ItemAnnotation,
  LibraryIndex,
  StudyNotes,
  Tag,
  UserData,
} from '../types'
import { effectiveDate, isValidYmd, publishedDate, suggestedDate } from '../lib/dates'
import {
  STORAGE_KEY,
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
  setNote: (id: string, note: string) => void
  setStudy: (id: string, patch: Partial<StudyNotes>) => void
  setCrop: (id: string, crop: CropParams) => void
  setDateOverride: (id: string, date: DateOverride | null) => void
  confirmDate: (ids: string[], kind: 'published' | 'suggested') => void
  setManualDate: (id: string, year: number, month: number, day: number) => void
  addTag: (name: string, dimensionId: string, color: string) => Tag
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
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seedTried = useRef(false)

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
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  // 首次访问时尝试读取仓库内的种子标注
  useEffect(() => {
    if (seedTried.current) return
    seedTried.current = true
    if (localStorage.getItem(STORAGE_KEY)) return
    loadSeedUserData().then((seed) => {
      if (!seed) return
      const hasContent =
        seed.tags.length > 0 || seed.collections.length > 0 || Object.keys(seed.items).length > 0
      if (hasContent) {
        setData(seed)
        saveLocalUserData(seed)
      }
    })
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

  const itemMap = useMemo(() => {
    const map = new Map<string, DiaryItem>()
    for (const item of index?.items ?? []) map.set(item.id, item)
    return map
  }, [index])

  const years = useMemo(() => {
    if (!index) return []
    return Object.keys(index.years).sort()
  }, [index])

  const tagMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t])), [data.tags])

  const tagUsage = useMemo(() => {
    const usage: Record<string, number> = {}
    for (const ann of Object.values(data.items)) {
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
        return { ...prev, tags: prev.tags.filter((t) => t.id !== id), items }
      })
    },
    [mutate],
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

  const importData = useCallback(
    (raw: unknown, mode: 'merge' | 'replace') => {
      const incoming = normalizeUserData(raw)
      setData((prev) => (mode === 'merge' ? mergeUserData(prev, incoming) : incoming))
    },
    [],
  )

  const loadSeed = useCallback(async () => {
    const seed = await loadSeedUserData()
    if (!seed) {
      notify('没有找到种子数据（public/data/userdata.seed.json）', 'error')
      return
    }
    setData((prev) => mergeUserData(prev, seed))
    notify('已合并仓库种子标注', 'success')
  }, [notify])

  const resetData = useCallback(() => {
    setData(emptyUserData())
    notify('本地标注已清空', 'success')
  }, [notify])

  const value = useMemo<StoreValue>(
    () => ({
      index,
      items: index?.items ?? [],
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
      setNote,
      setStudy,
      setCrop,
      setDateOverride,
      confirmDate,
      setManualDate,
      addTag,
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
      loadSeed,
      resetData,
    }),
    [
      index,
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
      setNote,
      setStudy,
      setCrop,
      setDateOverride,
      confirmDate,
      setManualDate,
      addTag,
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
      loadSeed,
      resetData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
