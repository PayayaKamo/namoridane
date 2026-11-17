import type { ItemAnnotation, Storyline, UserData } from '../types'

/**
 * 生成公开站种子：
 * - 去掉非绘日记、已删除图片和空标注
 * - 只保留人工确认过的日期（推测值绝不发布）
 * - 去掉私密备注、拆解笔记、收藏与裁切参数
 * - 只发布标记为 published 的故事线
 */
export function buildPublicData(data: UserData): UserData {
  const items: Record<string, ItemAnnotation> = {}
  const excludedIds: string[] = []
  for (const [id, ann] of Object.entries(data.items)) {
    if (!ann || ann.deleted) continue
    // 非绘日记：只留下 id 供公开站从索引中过滤，不携带任何标注内容
    if (ann.excluded) {
      excludedIds.push(id)
      continue
    }
    const next: ItemAnnotation = {
      tags: ann.tags,
      favorite: false,
      reviewed: ann.reviewed,
      excluded: false,
      note: '',
      updatedAt: ann.updatedAt,
    }
    if (ann.date?.confirmed) next.date = ann.date
    if (ann.xiaohongshu) next.xiaohongshu = ann.xiaohongshu
    if (ann.wechat) next.wechat = ann.wechat
    if (ann.translation) {
      next.translation = {
        source: ann.translation.source,
        slots: ann.translation.slots.map((slot) => ({ lang: slot.lang, label: slot.label, text: slot.text })),
        updatedAt: ann.translation.updatedAt,
      }
    }
    items[id] = next
  }
  const storylines = data.storylines.filter((story) => story.published)
  const rest = { ...data }
  delete rest.datasetId
  return {
    ...rest,
    items,
    excludedIds,
    collections: [],
    storylines,
    updatedAt: new Date().toISOString(),
  }
}

export function publishedStorylines(storylines: Storyline[]): Storyline[] {
  return storylines.filter((story) => story.published)
}
