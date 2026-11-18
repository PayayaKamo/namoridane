import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { effectiveDate } from '../lib/dates'
import { navigate, openItem } from '../lib/router'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'

const BASE = import.meta.env.BASE_URL

export function HomeView() {
  const { t } = useI18n()
  const { items, annotations, tagUsage, tags, collections, confirmedDiaryItems } = useStore()
  const [dailyId, setDailyId] = useState<string | null>(null)

  /** 与今天同月同日的全部作品（年份不限），按日记日期排序 */
  const sameDayItems = useMemo(() => {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()
    return items
      .filter((item) => {
        const d = effectiveDate(item, annotations[item.id])
        return d.month === month && d.day === day
      })
      .sort(
        (a, b) =>
          effectiveDate(a, annotations[a.id]).iso.localeCompare(effectiveDate(b, annotations[b.id]).iso) ||
          a.postIndex - b.postIndex,
      )
  }, [items, annotations])

  const dailyPick = useMemo(() => {
    if (!items.length) return undefined
    if (sameDayItems.length) {
      // 同年月同日有多张时，用本地日期作为种子轮转，保证当天多次打开结果一致
      const today = new Date()
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
      return sameDayItems[seed % sameDayItems.length]
    }
    // 没有同月同日：回退到最近一张已确认绘日记
    const confirmed = [...confirmedDiaryItems].sort(
      (a, b) =>
        effectiveDate(a, annotations[a.id]).iso.localeCompare(effectiveDate(b, annotations[b.id]).iso) ||
        a.postIndex - b.postIndex,
    )
    return confirmed[confirmed.length - 1] ?? items[items.length - 1]
  }, [items, sameDayItems, confirmedDiaryItems, annotations])

  const daily = (dailyId && items.find((i) => i.id === dailyId)) || dailyPick
  const dailyDate = daily ? effectiveDate(daily, annotations[daily.id]) : null
  const todayYear = new Date().getFullYear()

  const stats = useMemo(() => {
    let tagged = 0
    let favorites = 0
    let pending = 0
    let confirmed = 0
    for (const item of items) {
      const ann = annotations[item.id]
      if (ann?.tags.length) tagged++
      if (ann?.favorite) favorites++
      const d = effectiveDate(item, ann)
      if (d.confirmed) confirmed++
      else pending++
    }
    const years = [...new Set(items.map((item) => item.publishedAt.slice(0, 4)))].sort()
    return {
      tagged,
      favorites,
      pending,
      confirmed,
      yearFrom: years[0],
      yearTo: years[years.length - 1],
      yearCount: years.length,
    }
  }, [items, annotations])

  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      const year = item.publishedAt.slice(0, 4)
      counts[year] = (counts[year] ?? 0) + 1
    }
    return counts
  }, [items])
  const yearMax = useMemo(() => Math.max(1, ...Object.values(yearCounts)), [yearCounts])

  const topTags = useMemo(
    () =>
      [...tags]
        .filter((tag) => (tagUsage[tag.id] ?? 0) > 0)
        .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0))
        .slice(0, 8),
    [tags, tagUsage],
  )

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-main">
          <div className="page-eyebrow">{t('home.hero.eyebrow')}</div>
          <h1 className="hero-title">
            <span className="sr-only">{t('home.hero.srTitle')}</span>
            {t('home.hero.title')}
          </h1>
          <p className="hero-lead">{t('home.hero.lead', { count: items.length })}</p>
          <div className="row row-wrap" style={{ gap: 10, marginTop: 22 }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate2('/reader')}>
              <Icon name="book" size={16} />
              {t('home.hero.startReading')}
            </button>
            <button className="btn btn-lg" onClick={() => navigate2('/calendar')}>
              <Icon name="calendar" size={16} />
              {t('home.hero.openCalendar')}
            </button>
            <button className="btn btn-lg btn-ghost" onClick={() => navigate2('/gallery')}>
              {t('home.hero.openGallery')}
              <Icon name="right" size={14} />
            </button>
          </div>
        </div>
        {daily && dailyDate && (
          <div className="daily">
            <div className="daily-label">
              <span>{t('home.daily.label')}</span>
              <span className="hand">
                {t('common.fullDate', { year: dailyDate.year, month: dailyDate.month, day: dailyDate.day })}
              </span>
            </div>
            <button className="daily-image" onClick={() => openItem(daily.id)}>
              <img
                src={`${BASE}${daily.thumb}`}
                alt={t('home.daily.imageAlt', { date: dailyDate.iso })}
              />
            </button>
            <div className="daily-foot">
              <span className="faint">
                {dailyDate.year !== todayYear
                  ? t('home.daily.fromPastYear', { date: daily.publishedAt })
                  : t('common.publishedOn', { date: daily.publishedAt })}
                {!IS_PUBLIC && ` · ${daily.shortcode}`}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const pool = (sameDayItems.length > 1 ? sameDayItems : items).filter((i) => i.id !== daily.id)
                  if (!pool.length) return
                  setDailyId(pool[Math.floor(Math.random() * pool.length)]?.id ?? daily.id)
                }}
              >
                <Icon name="shuffle" size={13} />
                {t('home.daily.shuffle')}
              </button>
            </div>
          </div>
        )}
      </section>

      {!items.length && (
        <div className="excluded-banner">
          {IS_PUBLIC ? (
            <div>
              <strong>{t('home.empty.publicTitle')}</strong>
              <span>{t('home.empty.publicHint')}</span>
            </div>
          ) : (
            <div>
              <strong>{t('home.empty.localTitle')}</strong>
              <span>
                {t('home.empty.localHintBefore')}
                <code>npm run import -- "&lt;解压目录&gt;"</code>
                {t('home.empty.localHintAfterImport')}
                <code>npm run data</code>
                {t('home.empty.localHintAfterData')}
                <code>npm run dev</code>
                {t('home.empty.localHintAfterDev')}
              </span>
            </div>
          )}
        </div>
      )}

      <section className="stat-grid">
        <StatCard
          icon="gallery"
          label={t('home.stats.total')}
          value={String(items.length)}
          hint={t('home.stats.totalHint')}
        />
        <StatCard
          icon="calendar"
          label={t('home.stats.years')}
          value={`${stats.yearCount}`}
          hint={`${stats.yearFrom} — ${stats.yearTo}`}
        />
        <StatCard
          icon="tag"
          label={t('home.stats.tagged')}
          value={String(stats.tagged)}
          hint={t('home.stats.taggedHint', {
            count: tags.length,
            uses: Object.values(tagUsage).reduce((a, b) => a + b, 0),
          })}
        />
        {!IS_PUBLIC && (
          <>
            <StatCard
              icon="check"
              label={t('home.stats.pending')}
              value={String(stats.pending)}
              hint={t('home.stats.pendingHint', { count: stats.confirmed })}
              accent={stats.pending > 0}
            />
            <StatCard
              icon="heart"
              label={t('common.favorite')}
              value={String(stats.favorites)}
              hint={t('home.stats.favoritesHint')}
            />
            <StatCard
              icon="folder"
              label={t('common.collections')}
              value={String(collections.length)}
              hint={t('home.stats.collectionsHint')}
            />
          </>
        )}
      </section>

      <section className="home-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>{t('home.years.title')}</h3>
            {!IS_PUBLIC && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/stats')}>
                {t('home.years.viewStats')}
                <Icon name="right" size={13} />
              </button>
            )}
          </div>
          <div className="year-bars">
            {Object.entries(yearCounts)
              .sort()
              .map(([year, count]) => (
                <button
                  key={year}
                  className="year-bar"
                  onClick={() => navigate2(`/gallery?year=${year}`)}
                  title={t('home.years.barTitle', { year, count })}
                >
                  <span className="year-name num">{year}</span>
                  <span className="year-track">
                    <span className="year-fill" style={{ width: `${(count / yearMax) * 100}%` }} />
                  </span>
                  <span className="year-count num">{count}</span>
                </button>
              ))}
          </div>
          {topTags.length > 0 && (
            <>
              <div className="divider" />
              <div className="panel-head">
                <h3>{t('home.topTags.title')}</h3>
                {!IS_PUBLIC && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/tags')}>
                    {t('home.topTags.manage')}
                  </button>
                )}
              </div>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {topTags.map((tag) => (
                  <button
                    key={tag.id}
                    className="tag-pill"
                    style={{ ['--tag-color' as string]: tag.color, cursor: 'pointer' }}
                    onClick={() => navigate2(`/gallery?tag=${tag.id}`)}
                  >
                    {tag.name}
                    <span style={{ opacity: 0.65 }}>{tagUsage[tag.id]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>{t('home.quick.title')}</h3>
          </div>
          <div className="quick-grid">
            <QuickCard
              icon="calendar"
              title={t('home.quick.calendar.title')}
              desc={t('home.quick.calendar.desc')}
              to="/calendar"
            />
            <QuickCard
              icon="gallery"
              title={t('home.quick.gallery.title')}
              desc={t('home.quick.gallery.desc')}
              to="/gallery"
            />
            <QuickCard
              icon="users"
              title={t('home.quick.characters.title')}
              desc={t('home.quick.characters.desc')}
              to="/characters"
            />
            {!IS_PUBLIC && (
              <>
                <QuickCard
                  icon="check"
                  title={t('home.quick.review.title')}
                  desc={t('home.quick.review.desc')}
                  to="/review"
                />
                <QuickCard
                  icon="folder"
                  title={t('home.quick.collections.title')}
                  desc={t('home.quick.collections.desc')}
                  to="/collections"
                />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function navigate2(path: string) {
  navigate(path)
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: string
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div className={`stat-card${accent ? ' accent' : ''}`}>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon name={icon} size={16} />
        </span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value num">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  )
}

function QuickCard({ icon, title, desc, to }: { icon: string; title: string; desc: string; to: string }) {
  return (
    <button className="quick-card" onClick={() => navigate(to)}>
      <span className="quick-icon">
        <Icon name={icon} size={18} />
      </span>
      <span>
        <span className="quick-title">{title}</span>
        <span className="quick-desc">{desc}</span>
      </span>
      <Icon name="right" size={14} className="quick-arrow" />
    </button>
  )
}
