import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { effectiveDate } from '../lib/dates'
import { navigate, openItem } from '../lib/router'
import { IS_PUBLIC } from '../lib/appMode'

const BASE = import.meta.env.BASE_URL

export function HomeView() {
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
        .filter((t) => (tagUsage[t.id] ?? 0) > 0)
        .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0))
        .slice(0, 8),
    [tags, tagUsage],
  )

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-main">
          <div className="page-eyebrow">Namori · 水母绘日记 2021 — 2025</div>
          <h1 className="hero-title">把每一天，画成一页。</h1>
          <p className="hero-lead">
            收录 Namori 老师发布在 Instagram 的 {items.length} 张手绘日记。
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
              <span className="hand">
                {dailyDate.year} 年 {dailyDate.month} 月 {dailyDate.day} 日
              </span>
            </div>
            <button className="daily-image" onClick={() => openItem(daily.id)}>
              <img src={`${BASE}${daily.thumb}`} alt={`每日一图 ${dailyDate.iso}`} />
            </button>
            <div className="daily-foot">
              <span className="faint">
                {dailyDate.year !== todayYear
                  ? `往年今日 · ${daily.publishedAt} 发布`
                  : `${daily.publishedAt} 发布`}
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
                换一张
              </button>
            </div>
          </div>
        )}
      </section>

      {!items.length && (
        <div className="excluded-banner">
          {IS_PUBLIC ? (
            <div>
              <strong>内容正在整理</strong>
              <span>绘日记还在整理中，稍后再来看看。</span>
            </div>
          ) : (
            <div>
              <strong>还没有图片</strong>
              <span>
                把重新解压的 Instagram 保存页目录导入：<code>npm run import -- "&lt;解压目录&gt;"</code>，
                再运行 <code>npm run data</code>（或 <code>npm run dev</code>）生成索引和衍生图。
                标注会绑定当前数据集版本，换数据后旧记录自动作废。
              </span>
            </div>
          )}
        </div>
      )}

      <section className="stat-grid">
        <StatCard icon="gallery" label="总张数" value={String(items.length)} hint="按图内日记日期整理，已排除非绘日记" />
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
        {!IS_PUBLIC && (
          <>
            <StatCard
              icon="check"
              label="待校对日期"
              value={String(stats.pending)}
              hint={`已确认 ${stats.confirmed} 张`}
              accent={stats.pending > 0}
            />
            <StatCard icon="heart" label="收藏" value={String(stats.favorites)} hint="在详情页点按爱心" />
            <StatCard icon="folder" label="合集" value={String(collections.length)} hint="表情包 / 临摹参考分组" />
          </>
        )}
      </section>

      <section className="home-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>各年份收录</h3>
            {!IS_PUBLIC && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/stats')}>
                查看统计
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
                {!IS_PUBLIC && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate2('/tags')}>
                    管理
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
            <h3>快捷入口</h3>
          </div>
          <div className="quick-grid">
            <QuickCard icon="calendar" title="日历" desc="按月份查看每天画了什么" to="/calendar" />
            <QuickCard icon="gallery" title="图库" desc="瀑布流浏览与批量整理" to="/gallery" />
            <QuickCard icon="sticker" title="表情包工坊" desc="框选主体、去白底、导出" to="/stickers" />
            <QuickCard icon="users" title="角色图鉴" desc="按人物聚合的所有出场" to="/characters" />
            {!IS_PUBLIC && (
              <>
                <QuickCard icon="check" title="日期校对" desc="核对手写日期与发布日" to="/review" />
                <QuickCard icon="folder" title="合集" desc="把喜欢的收进同一本册子" to="/collections" />
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
