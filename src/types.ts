/** Windows OCR 预识别出的一个日期候选 */
export interface OcrCandidate {
  dateText: string
  year: number
  month: number
  day: number
  confidence: number
  engines: string[]
}

export interface OcrInfo {
  rawText: string
  candidates: OcrCandidate[]
}

/** 站点索引中的单张插画（由 scripts/build-index.mjs 生成） */
export interface DiaryItem {
  id: string
  shortcode: string
  file: string
  /** 导入时的原始文件名（Instagram CDN 名，含 _n 后缀）；旧索引可能为 null */
  sourceFile: string | null
  /** Instagram 原文案；元数据缺失时为 null */
  caption: string | null
  /** Instagram 原帖永久链接；无法确定时为 null */
  permalink: string | null
  postIndex: number
  postCount: number
  /** 审核结论：diary = 确认是绘日记，other = 确认非绘日记 */
  category: 'diary' | 'other'
  /** 是否进入公开构建（只有 category === 'diary' 才会公开） */
  includedInPublic: boolean
  /** 发布日期，来自文件名；日期未知时为空字符串 */
  publishedAt: string
  /** 文件名是否带可信的发布日期 */
  dateKnown: boolean
  /** 推断的日记日期（OCR 候选优先，否则发布日前一天），仅作输入框默认值，需人工确认 */
  inferredMonth: number
  inferredDay: number
  inferredYear: number
  /** 跨月/跨年提示：month | year | '' */
  rollover: '' | 'month' | 'year'
  /** Windows OCR 预识别结果，仅供参考，需人工确认 */
  ocr: OcrInfo | null
  /** OCR 最佳候选（年份已按发布日就近推断）；没有可用 OCR 时为 null */
  suggestedDiaryDate: { year: number; month: number; day: number } | null
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
  /** 数据集指纹：文件列表与大小决定，数据集变化时旧标注自动作废 */
  datasetId?: string
  count: number
  /** 无发布日期的图片数量 */
  undated?: number
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

/** 角色 / 人物实体的扩展信息；名称与颜色复用 character 维度下的标签 */
/** 角色简介：CV、职务与特点，缺省时回退到预置资料 */
export interface CharacterProfile {
  cv: string
  role: string
  traits: string
}

export interface Character {
  /** 与 Tag.id 相同 */
  id: string
  /** 头像来源：从某张图裁切 */
  avatarItemId?: string
  avatarCrop?: CropParams
  /** 或直接上传的小图（data URL） */
  avatarDataUrl?: string
  /** 占位头像（相对站点根，如 characters/char_x.webp）；上传/裁切头像优先 */
  avatar?: string
  /** 占位头像来源（URL 或站点名），便于替换时追溯 */
  avatarSource?: string
  /** 图鉴封面指定作品；缺省沿用头像 / 预置 / 最近一张作品 */
  coverItemId?: string
  /** 图鉴封面焦点（object-position 百分比）与小范围缩放 */
  coverCrop?: { x: number; y: number; zoom: number }
  /** 角色简介（CV / 职务 / 特点） */
  profile?: CharacterProfile
  note?: string
  createdAt: string
}

/** 翻译语言槽位，可增删 */
export interface TranslationSlot {
  /** 语言标识，如 zh / en / ja */
  lang: string
  /** 展示名，如「中文」「English」 */
  label: string
  text: string
}

/** 单张图片的翻译数据 */
export interface Translation {
  /** 原文（日文） */
  source: string
  /** 原文的待校对草稿（外部工具导入或人工录入），可合并进 source */
  sourceDraft?: string
  slots: TranslationSlot[]
  updatedAt: string
}

/** 故事线里的内容块：图片或章节备注 */
export interface StorylineBlock {
  id: string
  type: 'image' | 'note'
  itemId?: string
  text?: string
}

export interface Storyline {
  id: string
  title: string
  description: string
  coverItemId?: string
  blocks: StorylineBlock[]
  tags: string[]
  /** 是否随公开数据发布；草稿故事线不会出现在公开站 */
  published?: boolean
  createdAt: string
  updatedAt: string
}

export type ExternalLinkKind = 'xiaohongshu' | 'wechat'

export interface ItemAnnotation {
  tags: string[]
  favorite: boolean
  /** 是否已人工确认类型；与 excluded 组合成待确认 / 绘日记 / 非绘日记 */
  reviewed: boolean
  /** 确认不是绘日记后，默认从各视图隐藏；只改标注，不改原图 */
  excluded: boolean
  /** 已删除、等待本地清理原图；各视图会立即隐藏 */
  deleted?: boolean
  deletedAt?: string
  note: string
  translation?: Translation
  date?: DateOverride
  study?: StudyNotes
  crop?: CropParams
  /** 小红书跳转链接；只存 URL，没有发布时为空 */
  xiaohongshu?: string
  /** 微信公众号跳转链接；只存 URL，没有发布时为空 */
  wechat?: string
  updatedAt: string
}

export type DiaryReviewStatus = 'pending' | 'diary' | 'not_diary'

export interface ReviewExportRow {
  id: string
  file: string
  publishedAt: string
  status: DiaryReviewStatus
  diaryDate: string
  dateConfirmed: boolean
  dateSource: DateSource
}

export interface ReviewExportFile {
  type: 'namori-diary-review'
  version: 1
  updatedAt: string
  items: ReviewExportRow[]
}

export interface UserData {
  version: number
  /** 写入标注时对应的数据集版本；与索引不一致时整份标注作废 */
  datasetId?: string
  updatedAt: string
  dimensions: Dimension[]
  tags: Tag[]
  characters: Character[]
  collections: Collection[]
  storylines: Storyline[]
  items: Record<string, ItemAnnotation>
  /** 公开数据专用：确认非绘日记的条目 id，公开站据此从索引中排除；不含任何私有内容 */
  excludedIds?: string[]
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
  /** 翻译状态筛选：any 不限，none 未翻译，translated 已翻译 */
  translation: 'any' | 'none' | 'translated'
  collectionId: string
  sort: 'publishedAsc' | 'publishedDesc' | 'diaryAsc' | 'diaryDesc' | 'updatedDesc'
}
