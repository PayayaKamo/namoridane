import type {
  DiaryItem,
  DiaryReviewStatus,
  ItemAnnotation,
  ReviewExportFile,
  ReviewExportRow,
} from '../types'
import { effectiveDate } from './dates'
import { downloadJson } from './storage'

export function reviewStatusOf(annotation?: ItemAnnotation): DiaryReviewStatus {
  if (annotation?.excluded) return 'not_diary'
  return annotation?.reviewed ? 'diary' : 'pending'
}

export function createReviewExport(
  items: DiaryItem[],
  annotations: Record<string, ItemAnnotation>,
): ReviewExportFile {
  return {
    type: 'namori-diary-review',
    version: 1,
    updatedAt: new Date().toISOString(),
    items: items.map((item) => {
      const annotation = annotations[item.id]
      const date = effectiveDate(item, annotation)
      return {
        id: item.id,
        file: item.file,
        publishedAt: item.publishedAt,
        status: reviewStatusOf(annotation),
        diaryDate: date.iso,
        dateConfirmed: date.confirmed,
        dateSource: date.source,
      }
    }),
  }
}

export function downloadReviewJson(
  items: DiaryItem[],
  annotations: Record<string, ItemAnnotation>,
): void {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadJson(createReviewExport(items, annotations), `namori-diary-review-${stamp}.json`)
}

export function parseReviewExport(raw: unknown): ReviewExportFile | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<ReviewExportFile>
  if (value.type !== 'namori-diary-review' || value.version !== 1 || !Array.isArray(value.items)) return null
  const validStatuses = new Set<DiaryReviewStatus>(['pending', 'diary', 'not_diary'])
  const rows: ReviewExportRow[] = []
  for (const row of value.items) {
    if (!row || typeof row !== 'object') return null
    if (
      typeof row.id !== 'string' ||
      typeof row.file !== 'string' ||
      typeof row.publishedAt !== 'string' ||
      !validStatuses.has(row.status) ||
      typeof row.diaryDate !== 'string' ||
      typeof row.dateConfirmed !== 'boolean' ||
      !['inferred', 'published', 'manual'].includes(row.dateSource)
    ) {
      return null
    }
    rows.push(row)
  }
  return {
    type: 'namori-diary-review',
    version: 1,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    items: rows,
  }
}
