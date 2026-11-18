import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { localeTag } from '../i18n/core'
import { Icon } from '../components/Icon'

const BASE = import.meta.env.BASE_URL
const GITHUB_PROFILE = 'https://github.com/payayakamo'
const GITHUB_REPOSITORY = 'https://github.com/PayayaKamo/namoridane'
const XIAOHONGSHU = 'https://xhslink.cn/o/AmThiRAG07o'
const XIAOHONGSHU_ALT = 'https://xhslink.cn/o/22fet2ONRIv'

export function AboutView() {
  const { items, tags, getDate } = useStore()
  const { t, locale } = useI18n()
  const [qrOpen, setQrOpen] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!qrOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (qrRef.current?.contains(event.target as Node)) return
      setQrOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [qrOpen])

  const numberFormat = useMemo(() => new Intl.NumberFormat(localeTag(locale)), [locale])

  const summary = useMemo(() => {
    let yearFrom = ''
    let yearTo = ''
    for (const item of items) {
      const iso = getDate(item).iso || item.publishedAt
      const year = iso.slice(0, 4)
      if (!year) continue
      if (!yearFrom || year < yearFrom) yearFrom = year
      if (!yearTo || year > yearTo) yearTo = year
    }
    return {
      works: items.length,
      tags: tags.length,
      characters: tags.filter((tag) => tag.dimensionId === 'character').length,
      yearFrom,
      yearTo,
    }
  }, [items, tags, getDate])

  const years =
    summary.yearFrom && summary.yearTo
      ? summary.yearFrom === summary.yearTo
        ? summary.yearFrom
        : `${summary.yearFrom} — ${summary.yearTo}`
      : '—'

  const buildTime = useMemo(() => {
    const date = new Date(__BUILD_TIME__)
    if (Number.isNaN(date.getTime())) return __BUILD_TIME__
    return new Intl.DateTimeFormat(localeTag(locale), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
      timeZoneName: 'short',
    }).format(date)
  }, [locale])

  const facts: { label: string; value: string }[] = [
    { label: t('about.site.version'), value: `v${__APP_VERSION__}` },
    { label: t('about.site.buildTime'), value: buildTime },
    { label: t('about.site.works'), value: numberFormat.format(summary.works) },
    { label: t('about.site.years'), value: years },
    { label: t('about.site.characters'), value: numberFormat.format(summary.characters) },
    { label: t('about.site.tags'), value: numberFormat.format(summary.tags) },
  ]

  return (
    <div className="about">
      <header className="about-head">
        <div className="page-eyebrow">{t('about.eyebrow')}</div>
        <h1 className="about-title">{t('about.title')}</h1>
        <p className="about-lead">{t('about.lead')}</p>
      </header>

      <section className="about-section">
        <h2 className="about-section-title">{t('about.findMe')}</h2>
        <div className="about-links">
          <AboutLink
            href={GITHUB_PROFILE}
            icon="share"
            label={t('about.links.github.label')}
            desc={t('about.links.github.desc')}
          />
          <AboutLink
            href={GITHUB_REPOSITORY}
            icon="layers"
            label={t('about.links.repository.label')}
            desc={t('about.links.repository.desc')}
          />
          <AboutLink
            href={XIAOHONGSHU}
            icon="spark"
            label={t('about.links.xiaohongshu.label')}
            desc={t('about.links.xiaohongshu.desc')}
          />
          <AboutLink
            href={XIAOHONGSHU_ALT}
            icon="spark"
            label={t('about.links.xiaohongshuAlt.label')}
            desc={t('about.links.xiaohongshuAlt.desc')}
          />
          <div
            className="about-link about-link-wechat"
            ref={qrRef}
            onMouseEnter={() => setQrOpen(true)}
            onMouseLeave={() => setQrOpen(false)}
          >
            <button
              type="button"
              className="about-link-main"
              aria-expanded={qrOpen}
              onClick={() => setQrOpen((value) => !value)}
            >
              <span className="about-link-icon">
                <Icon name="qr" size={17} />
              </span>
              <span className="about-link-body">
                <span className="about-link-label">{t('about.links.wechat.label')}</span>
                <span className="about-link-desc">{t('about.links.wechat.desc')}</span>
              </span>
              <span className="about-link-hint">{t('about.links.wechat.hint')}</span>
            </button>
            {qrOpen && (
              <div className="about-qr">
                <img src={`${BASE}wechat-qr.webp`} alt={t('about.links.wechat.qrAlt')} width={180} height={180} />
                <span>{t('about.links.wechat.label')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-section-title">{t('about.site.title')}</h2>
        <dl className="about-facts">
          {facts.map((fact) => (
            <div className="about-fact" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="num">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="about-note">{t('about.site.note')}</p>
      </section>
    </div>
  )
}

function AboutLink({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <a className="about-link" href={href} target="_blank" rel="noopener noreferrer">
      <span className="about-link-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="about-link-body">
        <span className="about-link-label">{label}</span>
        <span className="about-link-desc">{desc}</span>
      </span>
      <Icon name="share" size={14} className="about-link-arrow" />
    </a>
  )
}
