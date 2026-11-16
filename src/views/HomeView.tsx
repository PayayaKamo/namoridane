import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { effectiveDate, dayOfYear, relativeTime } from '../lib/dates'
import { navigate, openItem } from '../lib/router'
import type { DiaryItem } from '../types'

const BASE = import.meta.env.BASE_URL

export function HomeView() {
  const { index, items, annotations, tagUsage, tags, collections } = useStore()
  const [dailyId, setDailyId] = useState<string | null>(null)

  const dailyPick = useMemo(() => {
    if (!items.length) return undefined
    const today = new Date()
    const seed = today.getFullYear() * 1000 + dayOfYear(today.getFullYear(), today.getMonth() + 1, today.getDate())
    return items[seed % items.length]
  }, [items])

  const daily = (dailyId && items.find((i) => i.id === dailyId)) || dailyPick
  const dailyDate = daily ? effectiveDate(daily, annotations[daily.id]) : null

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
    const years = Object.keys(index?.years ?? {}).sort()
    return {
      tagged,
      favorites,
      pending,
      confirmed,
      yearFrom: years[0],
      yearTo: years[years.length - 1],
      yearCount: years.length,
    }
  }, [items, annotations, index])

  const yearMax = useMemo(() => Math.max(1, ...Object.values(index?.years ?? {})), [index])

  const recent = useMemo(() => {
    return Object.entries(annotations)
      .filter(([, ann]) => ann.updatedAt && new Date(ann.updatedAt).getTime() > 1000)
      .sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime())
      .slice(0, 6)
      .map(([id, ann]) => ({ item: items.find((i) => i.id === id), ann }))
      .filter((x): x is { item: DiaryItem; ann: (typeof annotations)[string] } => Boolean(x.item))
  }, [annotations, items])

  const latest = useMemo(() => [...items].slice(-6).reverse(), [items])
  const strip = recent.length ? recent.map((r) => r.item) : latest

  const topTags = useMemo(
    () =>
      [...tags]
        .filter((t) => (tagUsage[t.id] ?? 0) > 0)
        .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0))
        .slice(0, 8),
    [tags, tagUsage],
  )

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-main">
          <div className="page-eyebrow">Namori · 绘日记 2021 — 2025</div>
          <h1 className="hero-title">把每一天，画成一页。</h1>
          <p className="hero-lead">
            收录 Namori 老师发布在 Instagram 的 {index?.count ?? 0} 张手绘日记。
            在这里按日历翻阅、按角色与场景整理，也可以裁成表情包、记录临摹拆解。
          </p>
          <div className="row row-wrap" style={{ gap: 10, marginTop: 22 }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate2('/reader')}>
              <Icon name="book" size={16} />
              开始翻阅
            </button>
            <button className="btn btn-lg" onClick={() => navigate2('/calendar')}>
              <Icon name="calendar" size={16} />
              看日历
            </button>
            <button className="btn btn-lg btn-ghost" onClick={() => navigate2('/gallery')}>
              进入图库
              <Icon name="right" size={14} />
            </button>
          </div>
        </div>
        {daily && dailyDate && (
          <div className="daily">
            <div className="daily-label">
              <span>每日一图</span>
              <span className="hand">{dailyDate.month} 月 {dailyDate.day} 日</span>
            </div>
            <button className="daily-image" onClick={() => openItem(daily.id)}>
              <img src={`${BASE}${daily.thumb}`} alt={`每日一图 ${dailyDate.iso}`} />
            </button>
            <div className="daily-foot">
              <span className="faint">{daily.publishedAt} 发布</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const pool = items.filter((i) => i.id !== daily.id)
                  setDailyId(pool[Math.floor(Math.random() * pool.length)]?.id ?? daily.id)
                }}
              >
                <Icon name="shuffle" size={13} />
                换一张
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="stat-grid">
        <StatCard icon="gallery" label="总张数" value={String(index?.count ?? 0)} hint="1072 张已全部生成缩略图" />
        <StatCard
          icon="calendar"
          label="覆盖年份"
          value={`${stats.yearCount}`}
          hint={`${stats.yearFrom} — ${stats.yearTo}`}
        />
        <StatCard
          icon="tag"
          label="已打标签"
          value={String(stats.tagged)}
          hint={`共 ${tags.length} 个标签，${Object.values(tagUsage).reduce((a, b) => a + b, 0)} 次使用`}
        />
        <StatCard
          icon="check"
          label="待校对日期"
          value={String(stats.pending)}
          hint={`已确认 ${stats.confirmed} 张`}
          accent={stats.pending > 0}
        />
        <StatCard icon="heart" label="收藏" value={String(stats.favorites)} hint="在详情页点按爱心" />
        <StatCard icon="folder" label="合集" value={String(collections.length)} hint="表情包 / 临摹参考分组" />
      </section>

      <section className="home-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>各年份收录</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/stats')}>
              查看统计
              <Icon name="right" size={13} />
            </button>
          </div>
          <div className="year-bars">
            {Object.entries(index?.years ?? {})
              .sort()
              .map(([year, count]) => (
                <button
                  key={year}
                  className="year-bar"
                  onClick={() => navigate2(`/gallery?year=${year}`)}
                  title={`${year} · ${count} 张`}
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
                <h3>常用标签</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/tags')}>
                  管理
                </button>
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
            <h3>快捷入口</h3>
          </div>
          <div className="quick-grid">
            <QuickCard icon="calendar" title="日历" desc="按月份查看每天画了什么" to="/calendar" />
            <QuickCard icon="gallery" title="图库" desc="瀑布流浏览与批量整理" to="/gallery" />
            <QuickCard icon="sticker" title="表情包工坊" desc="框选主体、去白底、导出" to="/stickers" />
            <QuickCard icon="users" title="角色图鉴" desc="按人物聚合的所有出场" to="/characters" />
            <QuickCard icon="check" title="日期校对" desc="核对手写日期与发布日" to="/review" />
            <QuickCard icon="folder" title="合集" desc="把喜欢的收进同一本册子" to="/collections" />
          </div>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-head">
          <h3>{recent.length ? '最近整理' : '最近发布'}</h3>
          <span className="faint">
            {recent.length ? `更新于 ${relativeTime(recent[0].ann.updatedAt)}` : `${strip.length} 张`}
          </span>
        </div>
        <div className="recent-strip">
          {strip.map((item) => (
            <button key={item.id} className="recent-item" onClick={() => openItem(item.id)}>
              <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" />
              <span className="recent-date hand">
                {effectiveDate(item, annotations[item.id]).month} / {effectiveDate(item, annotations[item.id]).day}
              </span>
            </button>
          ))}
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
