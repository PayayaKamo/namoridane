const DATE_SOURCES = new Set(['inferred', 'published', 'manual'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** 校验完整管理端 userdata；结构不符时抛错，调用方不应覆盖旧文件 */
export function validateUserData(raw) {
  if (!isPlainObject(raw)) throw new Error('不是有效的 JSON 对象')
  if (raw.version !== 2) throw new Error(`version 必须为 2，实际为 ${JSON.stringify(raw.version)}`)
  if (!isPlainObject(raw.items)) throw new Error('缺少 items 对象')
  for (const [id, annotation] of Object.entries(raw.items)) {
    if (!isPlainObject(annotation)) throw new Error(`items["${id}"] 不是对象`)
  }
  if (raw.tags !== undefined && !Array.isArray(raw.tags)) throw new Error('tags 必须是数组')
  if (raw.collections !== undefined && !Array.isArray(raw.collections)) throw new Error('collections 必须是数组')
  return raw
}

/** 校验「导出审核 JSON」（type: namori-diary-review） */
export function validateReviewExport(raw) {
  if (!isPlainObject(raw)) throw new Error('不是有效的 JSON 对象')
  if (raw.type !== 'namori-diary-review' || raw.version !== 1) {
    throw new Error('不是 namori-diary-review v1 审核导出文件')
  }
  if (!Array.isArray(raw.items)) throw new Error('缺少 items 数组')
  const statuses = new Set(['pending', 'diary', 'not_diary'])
  for (const row of raw.items) {
    if (!isPlainObject(row)) throw new Error('审核条目不是对象')
    if (typeof row.id !== 'string' || !row.id) throw new Error('审核条目缺少 id')
    if (!statuses.has(row.status)) throw new Error(`审核条目 ${row.id} 的 status 非法`)
    if (typeof row.diaryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.diaryDate)) {
      throw new Error(`审核条目 ${row.id} 的 diaryDate 非法`)
    }
  }
  return raw
}

/**
 * 服务端再次裁剪公开数据：只保留公开字段。
 * 与 src/lib/publish.ts 的 buildPublicData 保持一致，避免客户端传入私有内容。
 */
export function sanitizePublicData(raw) {
  validateUserData(raw)
  const now = new Date().toISOString()
  const items = {}
  for (const [id, annotation] of Object.entries(raw.items)) {
    if (!annotation || annotation.excluded || annotation.deleted) continue
    const next = {
      tags: Array.isArray(annotation.tags) ? annotation.tags.filter((t) => typeof t === 'string') : [],
      favorite: false,
      reviewed: Boolean(annotation.reviewed),
      excluded: false,
      note: '',
      updatedAt: typeof annotation.updatedAt === 'string' ? annotation.updatedAt : now,
    }
    if (isPlainObject(annotation.date) && annotation.date.confirmed) {
      next.date = {
        year: Number(annotation.date.year),
        month: Number(annotation.date.month),
        day: Number(annotation.date.day),
        confirmed: true,
        source: DATE_SOURCES.has(annotation.date.source) ? annotation.date.source : 'inferred',
      }
    }
    if (typeof annotation.xiaohongshu === 'string' && annotation.xiaohongshu.trim()) {
      next.xiaohongshu = annotation.xiaohongshu.trim()
    }
    if (typeof annotation.wechat === 'string' && annotation.wechat.trim()) {
      next.wechat = annotation.wechat.trim()
    }
    if (isPlainObject(annotation.translation)) {
      const slots = Array.isArray(annotation.translation.slots)
        ? annotation.translation.slots
            .filter((slot) => isPlainObject(slot) && typeof slot.lang === 'string')
            .map((slot) => ({
              lang: slot.lang,
              label: typeof slot.label === 'string' ? slot.label : slot.lang,
              text: typeof slot.text === 'string' ? slot.text : '',
            }))
        : []
      next.translation = {
        source: typeof annotation.translation.source === 'string' ? annotation.translation.source : '',
        slots,
        updatedAt:
          typeof annotation.translation.updatedAt === 'string' ? annotation.translation.updatedAt : now,
      }
    }
    items[id] = next
  }
  const result = { ...raw }
  delete result.datasetId
  return {
    ...result,
    version: 2,
    updatedAt: now,
    items,
    collections: [],
    storylines: Array.isArray(raw.storylines)
      ? raw.storylines.filter((storyline) => storyline && storyline.published)
      : [],
  }
}

/** 把审核导出合并进现有 userdata，只更新审核状态与日期，其余字段原样保留 */
export function applyReviewExport(baseUserData, reviewExport) {
  validateUserData(baseUserData)
  validateReviewExport(reviewExport)
  const next = JSON.parse(JSON.stringify(baseUserData))
  const now = new Date().toISOString()
  let applied = 0
  for (const row of reviewExport.items) {
    const annotation = isPlainObject(next.items[row.id])
      ? next.items[row.id]
      : { tags: [], favorite: false, reviewed: false, excluded: false, note: '', updatedAt: now }
    annotation.reviewed = row.status !== 'pending'
    annotation.excluded = row.status === 'not_diary'
    annotation.updatedAt = now
    const [year, month, day] = row.diaryDate.split('-').map(Number)
    annotation.date = {
      year,
      month,
      day,
      confirmed: Boolean(row.dateConfirmed),
      source: DATE_SOURCES.has(row.dateSource) ? row.dateSource : 'inferred',
    }
    next.items[row.id] = annotation
    applied += 1
  }
  next.updatedAt = now
  return { data: next, applied }
}
