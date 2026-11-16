import type { DateOverride, DiaryItem, EffectiveDate, ItemAnnotation } from '../types'

export const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六']
export const MONTHS_CN = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day || 1), daysInMonth(year, month))
}

/** 该月第一天是周几（0 = 周日） */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

/** 判断某天是否有图 */
export function effectiveDate(item: DiaryItem, annotation?: ItemAnnotation): EffectiveDate {
  if (annotation?.date) {
    const d = annotation.date
    return {
      year: d.year,
      month: d.month,
      day: d.day,
      iso: isoOf(d.year, d.month, d.day),
      confirmed: d.confirmed,
      source: d.source,
    }
  }
  return {
    year: item.inferredYear,
    month: item.inferredMonth,
    day: item.inferredDay,
    iso: isoOf(item.inferredYear, item.inferredMonth, item.inferredDay),
    confirmed: false,
    source: 'inferred',
  }
}

export function publishedParts(item: DiaryItem) {
  return parseISO(item.publishedAt)
}

export function suggestedDate(item: DiaryItem): DateOverride {
  return {
    year: item.inferredYear,
    month: item.inferredMonth,
    day: item.inferredDay,
    confirmed: false,
    source: 'inferred',
  }
}

export function publishedDate(item: DiaryItem): DateOverride {
  const p = publishedParts(item)
  return { year: p.year, month: p.month, day: p.day, confirmed: true, source: 'published' }
}

export function isoFromOverride(d: DateOverride): string {
  return isoOf(d.year, d.month, d.day)
}

export function formatFullDate(iso: string): string {
  const { year, month, day } = parseISO(iso)
  return `${year} 年 ${month} 月 ${day} 日`
}

export function formatMonthDay(month: number, day: number): string {
  return `${month} 月 ${day} 日`
}

export function formatShortDate(iso: string): string {
  const { year, month, day } = parseISO(iso)
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

export function todayKey(): string {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function weekdayLabel(iso: string): string {
  const { year, month, day } = parseISO(iso)
  return `周${WEEKDAYS_CN[new Date(year, month - 1, day).getDay()]}`
}

/** 该日期在一年中的第几天，出租统计用 */
export function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0)
  const current = Date.UTC(year, month - 1, day)
  return Math.round((current - start) / 86400000)
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isValidYmd(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > daysInMonth(year, month)) return false
  if (year < 1900 || year > 2200) return false
  return true
}
