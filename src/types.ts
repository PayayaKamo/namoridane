/** 站点索引中的单张插画（由 scripts/build-index.mjs 生成） */
export interface DiaryItem {
  id: string
  shortcode: string
  file: string
  postIndex: number
  postCount: number
  /** 发布日期，来自文件名 */
  publishedAt: string
  /** 推断的日记日期（发布日前一天），只有月/日可信 */
  inferredMonth: number
  inferredDay: number
  inferredYear: number
  /** 跨月/跨年提示：month | year | '' */
  rollover: '' | 'month' | 'year'
  thumb: string
  large: string
  /** 原始 JPG，供下载与查看 */
  original: string
  /** 原图字节数 */
  bytes: number
  w: number
  h: number
  palette: string[]
  color: string
}

export interface LibraryIndex {
  version: number
  generatedAt: string
  count: number
  years: Record<string, number>
  items: DiaryItem[]
}

export interface Dimension {
  id: string
  name: string
  order: number
  builtIn?: boolean
}

export interface Tag {
  id: string
  name: string
  dimensionId: string
  color: string
  createdAt: string
}

export interface Collection {
  id: string
  name: string
  description: string
  coverItemId?: string
  itemIds: string[]
  createdAt: string
  updatedAt: string
}

export type DateSource = 'inferred' | 'published' | 'manual'

export interface DateOverride {
  year: number
  month: number
  day: number
  confirmed: boolean
  source: DateSource
}

export interface StudyNotes {
  composition: string
  palette: string
  linework: string
  expression: string
  memo: string
}

/** 表情包裁切参数，全部为原图的比例值，便于跨尺寸复用 */
export interface CropParams {
  /** 方形裁切中心点（0~1） */
  cx: number
  cy: number
  /** 方形边长占原图短边比例（0~1） */
  size: number
  /** 白底转透明的容差 0~100 */
  tolerance: number
  /** 是否执行去白底 */
  transparent: boolean
}

export interface ItemAnnotation {
  tags: string[]
  favorite: boolean
  /** 标记为非绘日记后，默认从各视图隐藏，可在排除区恢复 */
  excluded: boolean
  note: string
  date?: DateOverride
  study?: StudyNotes
  crop?: CropParams
  updatedAt: string
}

export interface UserData {
  version: number
  updatedAt: string
  dimensions: Dimension[]
  tags: Tag[]
  collections: Collection[]
  items: Record<string, ItemAnnotation>
}

export interface EffectiveDate {
  year: number
  month: number
  day: number
  iso: string
  confirmed: boolean
  source: DateSource
}

export interface FilterState {
  keyword: string
  year: string
  month: string
  from: string
  to: string
  tagIds: string[]
  tagMode: 'any' | 'all'
  /** 按维度设置「任一 / 全部」，跨维度之间始终是 AND */
  dimensionModes: Record<string, 'any' | 'all'>
  favoriteOnly: boolean
  unconfirmedOnly: boolean
  collectionId: string
  sort: 'publishedAsc' | 'publishedDesc' | 'diaryAsc' | 'diaryDesc' | 'updatedDesc'
}
