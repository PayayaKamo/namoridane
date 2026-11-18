import { zh, type Messages } from './messages/zh'
import { ja } from './messages/ja'
import { en } from './messages/en'

export type Locale = 'zh' | 'ja' | 'en'

export const LOCALES: readonly Locale[] = ['zh', 'ja', 'en']

/** 语言切换入口展示用的自有名称 */
export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  ja: '日本語',
  en: 'English',
}

/** <html lang> 与 Intl 使用的 BCP 47 标记 */
export const LOCALE_TAGS: Record<Locale, string> = {
  zh: 'zh-CN',
  ja: 'ja-JP',
  en: 'en-US',
}

const STORAGE_KEY = 'namori.locale'

const MESSAGES: Record<Locale, Messages> = { zh, ja, en }

/** 递归展开嵌套文案对象，得到 `namespace.key` 形式的联合类型 */
type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`
}[keyof T & string]

export type MessageKey = LeafKeys<Messages>

export type TranslateParams = Record<string, string | number>

function normalizeLocale(code: string | undefined | null): Locale | null {
  if (!code) return null
  const lower = code.toLowerCase()
  if (lower.startsWith('zh')) return 'zh'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('en')) return 'en'
  return null
}

function readStoredLocale(): Locale | null {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/** 默认跟随浏览器语言；无法匹配时回落中文 */
export function detectLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored
  if (typeof navigator !== 'undefined') {
    const candidates = [...(navigator.languages ?? []), navigator.language]
    for (const candidate of candidates) {
      const matched = normalizeLocale(candidate)
      if (matched) return matched
    }
  }
  return 'zh'
}

let currentLocale: Locale = detectLocale()

const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return currentLocale
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function syncDocument(): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = LOCALE_TAGS[currentLocale]
}

/** 手动选择后写入 localStorage，并通过订阅通知界面重渲染 */
export function setLocale(next: Locale): void {
  if (!LOCALES.includes(next) || next === currentLocale) return
  currentLocale = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 隐私模式下 localStorage 不可写，仅本次会话生效
  }
  syncDocument()
  for (const listener of listeners) listener()
}

/** 供非 React 模块（日期格式化、提示消息等）读取当前语言 */
export function localeTag(locale: Locale = currentLocale): string {
  return LOCALE_TAGS[locale]
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  )
}

/** 缺失的 key 回落到中文，再回落到 key 本身，避免界面出现空白 */
export function translate(key: MessageKey, params?: TranslateParams): string {
  const template = lookup(MESSAGES[currentLocale], key) ?? lookup(zh, key) ?? key
  return interpolate(template, params)
}

syncDocument()
