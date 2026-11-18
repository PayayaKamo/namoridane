import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import {
  LOCALES,
  LOCALE_LABELS,
  detectLocale,
  getLocale,
  setLocale,
  subscribeLocale,
  translate,
  type Locale,
  type MessageKey,
  type TranslateParams,
} from './core'

export type { Locale, MessageKey, TranslateParams }
export { LOCALES, LOCALE_LABELS }

/** 语言状态存放在模块级 store，组件通过 useI18n 订阅切换 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)

  useEffect(() => {
    // 首屏同步一次：检测结果与站点标题跟随语言
    if (getLocale() !== detectLocale()) setLocale(detectLocale())
    document.title = translate('shell.siteTitle')
  }, [locale])

  return <>{children}</>
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)

  const t = useCallback((key: MessageKey, params?: TranslateParams) => translate(key, params), [])

  return useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, t],
  )
}
