import { LOCALES, LOCALE_LABELS, useI18n } from '../i18n'

const SHORT: Record<string, string> = { zh: '中', ja: '日', en: 'EN' }

/** 侧栏完整三档切换；顶部栏只放一个循环切换的紧凑按钮 */
export function LocaleSwitch({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { locale, setLocale, t } = useI18n()

  if (variant === 'compact') {
    const index = LOCALES.indexOf(locale)
    const next = LOCALES[(index + 1) % LOCALES.length]
    return (
      <button
        className="icon-btn locale-cycle"
        onClick={() => setLocale(next)}
        title={`${t('shell.localeSwitch')} · ${LOCALE_LABELS[locale]}`}
        aria-label={`${t('shell.localeSwitch')}: ${LOCALE_LABELS[locale]}`}
      >
        {SHORT[locale]}
      </button>
    )
  }

  return (
    <div className="locale-switch" role="group" aria-label={t('shell.localeSwitch')}>
      {LOCALES.map((id) => (
        <button
          key={id}
          className={id === locale ? 'active' : ''}
          onClick={() => setLocale(id)}
          aria-pressed={id === locale}
          title={LOCALE_LABELS[id]}
        >
          {SHORT[id]}
        </button>
      ))}
    </div>
  )
}
