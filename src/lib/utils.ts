import type { ExternalLinkKind } from '../types'

const LINK_HOSTS: Record<ExternalLinkKind, string[]> = {
  xiaohongshu: ['xhslink.com', 'xiaohongshu.com'],
  wechat: ['mp.weixin.qq.com'],
}

/** 分享文案里可能夹带口令与中文标点，这里只截取干净的 URL */
const URL_PATTERN = /https?:\/\/[^\s\u4e00-\u9fa5，。！？、；：“”‘’（）【】《》<>]+/gi

function matchesKind(url: string, kind: ExternalLinkKind): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return LINK_HOSTS[kind].some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * 从整段分享文案中提取指定平台的第一个 URL。
 * 粘贴内容本身就是无协议域名时补上 https://；无法识别则返回 null。
 */
export function extractShareUrl(raw: string, kind: ExternalLinkKind): string | null {
  const text = raw?.trim()
  if (!text) return null
  for (const match of text.match(URL_PATTERN) ?? []) {
    const url = match.replace(/[),.;!?]+$/, '')
    if (matchesKind(url, kind)) return url
  }
  const bare = text.replace(/[),.;!?]+$/, '')
  if (LINK_HOSTS[kind].some((h) => bare.toLowerCase().startsWith(`${h}/`))) {
    const url = `https://${bare}`
    if (matchesKind(url, kind)) return url
  }
  return null
}

export function uid(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}${raw}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }) as T
}
