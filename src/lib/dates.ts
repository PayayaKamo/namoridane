import type { DateOverride, DiaryItem, EffectiveDate, ItemAnnotation } from '../types'
import { IS_PUBLIC } from './appMode'

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
  if (!year || !month || !day) return ''
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
  // 公开站不展示任何推测日期，只认人工确认值
  if (IS_PUBLIC) {
    return { year: 0, month: 0, day: 0, iso: '', confirmed: false, source: 'inferred' }
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
  if (!iso) return '日期待定'
  const { year, month, day } = parseISO(iso)
  return `${year} 年 ${month} 月 ${day} 日`
}

export function formatMonthDay(month: number, day: number): string {
  if (!month || !day) return '日期待定'
  return `${month} 月 ${day} 日`
}

export function formatShortDate(iso: string): string {
  if (!iso) return '日期待定'
  const { year, month, day } = parseISO(iso)
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

export function todayKey(): string {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function weekdayLabel(iso: string): string {
  if (!iso) return '日期待定'
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

export interface DateQuery {
  /** 带年份时聚焦该年；只有月/日时为空 */
  year?: number
  month: number
  day: number
}

/** 从搜索词里识别日期：20261117 / 2026-11-17 / 11-17 / 11/17 / 11月17日 */
export function parseDateQuery(raw: string): DateQuery | null {
  const text = raw.trim()
  if (!text) return null

  const check = (year: number | undefined, month: number, day: number): DateQuery | null => {
    if (month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year ?? 2024, month)) return null
    if (year !== undefined && (year < 1900 || year > 2200)) return null
    return { year, month, day }
  }

  const full = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(text)
  if (full) return check(Number(full[1]), Number(full[2]), Number(full[3]))

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (compact) return check(Number(compact[1]), Number(compact[2]), Number(compact[3]))

  const zh = /^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(text)
  if (zh) return check(undefined, Number(zh[1]), Number(zh[2]))

  const monthDay = /^(\d{1,2})[-./](\d{1,2})$/.exec(text)
  if (monthDay) return check(undefined, Number(monthDay[1]), Number(monthDay[2]))

  return null
}

export function dayQueryOf(query: DateQuery): string {
  return `${String(query.month).padStart(2, '0')}-${String(query.day).padStart(2, '0')}`
}

export function formatMonthDayCN(month: number, day: number): string {
  return `${month} 月 ${day} 日`
}
