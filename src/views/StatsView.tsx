import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { MONTHS_CN, effectiveDate } from '../lib/dates'

export function StatsView() {
  const { items, annotations, tags, dimensions, tagUsage, collections, data, getDate } = useStore()
  const [year, setYear] = useState(() => {
    const years = [...new Set(items.map((i) => getDate(i).year))].sort()
    return years[years.length - 1] ?? new Date().getFullYear()
  })

  const summary = useMemo(() => {
    const dates = new Set<string>()
    let confirmed = 0
    let favorites = 0
    let withNotes = 0
    let tagged = 0
    let minDate = ''
    let maxDate = ''
    for (const item of items) {
      const d = effectiveDate(item, annotations[item.id])
      dates.add(d.iso)
      if (!minDate || d.iso < minDate) minDate = d.iso
      if (!maxDate || d.iso > maxDate) maxDate = d.iso
      if (d.confirmed) confirmed++
      if (annotations[item.id]?.favorite) favorites++
      if (annotations[item.id]?.note || annotations[item.id]?.study) withNotes++
      if (annotations[item.id]?.tags.length) tagged++
    }
    const sorted = [...dates].sort()
    let longest = 0
    let current = 0
    let prev: number | null = null
    for (const iso of sorted) {
      const t = new Date(`${iso}T00:00:00`).getTime()
      if (prev !== null && t - prev === 86400000) current++
      else current = 1
      longest = Math.max(longest, current)
      prev = t
    }
    const posts = new Set(items.map((i) => i.shortcode))
    return {
      confirmed,
      favorites,
      withNotes,
      tagged,
      days: dates.size,
      minDate,
      maxDate,
      longest,
      posts: posts.size,
      multi: items.filter((i) => i.postCount > 1).length,
    }
  }, [items, annotations])

  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of items) {
      const y = getDate(item).year
      counts.set(y, (counts.get(y) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0])
  }, [items, getDate])

  const maxYear = Math.max(1, ...yearCounts.map(([, c]) => c))

  const monthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    for (const item of items) {
      const d = getDate(item)
      if (d.year === year) counts[d.month - 1]++
    }
    return counts
  }, [items, getDate, year])
  const maxMonth = Math.max(1, ...monthCounts)

  const monthDays = useMemo(() => {
    const sets = Array.from({ length: 12 }, () => new Set<string>())
    for (const item of items) {
      const d = getDate(item)
      if (d.year === year) sets[d.month - 1].add(d.iso)
    }
    return sets.map((s) => s.size)
  }, [items, getDate, year])

  const paletteCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const hex of item.palette ?? []) {
        counts.set(hex, (counts.get(hex) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
  }, [items])

  const tagGroups = useMemo(
    () =>
      dimensions
        .map((dim) => ({
          dim,
          tags: tags
            .filter((t) => t.dimensionId === dim.id && (tagUsage[t.id] ?? 0) > 0)
            .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0))
            .slice(0, 6),
        }))
        .filter((g) => g.tags.length > 0),
    [dimensions, tags, tagUsage],
  )

  const maxTag = Math.max(1, ...tags.map((t) => tagUsage[t.id] ?? 0))

  return (
    <div className="stats-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Insights</div>
          <h2 className="page-title">统计</h2>
          <div className="page-sub">
            {summary.minDate} — {summary.maxDate} · 共 {items.length} 张（{summary.posts} 个帖子）
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="gallery" size={16} /></span>
            <span className="stat-label">作品</span>
          </div>
          <div className="stat-value num">{items.length}</div>
          <div className="stat-hint">其中多图帖 {summary.multi} 张</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="calendar" size={16} /></span>
            <span className="stat-label">有画的日子</span>
          </div>
          <div className="stat-value num">{summary.days}</div>
          <div className="stat-hint">最长连续 {summary.longest} 天</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="tag" size={16} /></span>
            <span className="stat-label">已归类</span>
          </div>
          <div className="stat-value num">{summary.tagged}</div>
          <div className="stat-hint">{tags.length} 个标签 · {collections.length} 个合集</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="check" size={16} /></span>
            <span className="stat-label">日期已确认</span>
          </div>
          <div className="stat-value num">{summary.confirmed}</div>
          <div className="stat-hint">待校对 {items.length - summary.confirmed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="heart" size={16} /></span>
            <span className="stat-label">收藏 / 笔记</span>
          </div>
          <div className="stat-value num">{summary.favorites}</div>
          <div className="stat-hint">拆解或备注 {summary.withNotes} 张</div>
        </div>
      </div>

      <div className="stats-two">
        <section className="panel">
          <div className="panel-head">
            <h3>月度张数</h3>
            <select className="select select-mini" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearCounts.map(([y]) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </div>
          <div className="bar-chart">
            {monthCounts.map((count, idx) => (
              <div key={idx} className="bar-col" title={`${MONTHS_CN[idx]} · ${count} 张 · ${monthDays[idx]} 天`}>
                <span className="bar-value num">{count || ''}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${(count / maxMonth) * 100}%` }} />
                </div>
                <span className="bar-label">{idx + 1}</span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            深色柱为作品数，悬停可看当月有画的天数。
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>年度概览</h3>
          </div>
          <div className="year-table">
            {yearCounts.map(([y, count]) => (
              <div key={y} className="year-row">
                <span className="num">{y}</span>
                <div className="year-track">
                  <div className="year-fill" style={{ width: `${(count / maxYear) * 100}%` }} />
                </div>
                <span className="num">{count}</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <div className="meta-list">
            <div className="meta-row">
              <span>平均每天</span>
              <span className="num">{(items.length / Math.max(1, summary.days)).toFixed(2)} 张</span>
            </div>
            <div className="meta-row">
              <span>覆盖跨度</span>
              <span className="num">{summary.minDate} → {summary.maxDate}</span>
            </div>
            <div className="meta-row">
              <span>本地标注</span>
              <span className="num">{Object.keys(data.items).length} 条记录</span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>标签分布</h3>
          <span className="faint">按维度分组 · 前 6 名</span>
        </div>
        {tagGroups.length ? (
          <div className="tag-dist-grid">
            {tagGroups.map(({ dim, tags: groupTags }) => (
              <div key={dim.id} className="tag-dist">
                <div className="field-label">{dim.name}</div>
                {groupTags.map((tag) => (
                  <div key={tag.id} className="dist-row">
                    <span className="dist-name">{tag.name}</span>
                    <span className="dist-track">
                      <span
                        className="dist-fill"
                        style={{ width: `${((tagUsage[tag.id] ?? 0) / maxTag) * 100}%`, background: tag.color }}
                      />
                    </span>
                    <span className="num dist-count">{tagUsage[tag.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="faint">还没有使用标签。去图库多选作品批量打标签后，这里会出现分布。</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>作品主色分布</h3>
          <span className="faint">全部缩略图提取的 6 色色板中出现频次</span>
        </div>
        <div className="palette-band">
          {paletteCounts.map(([hex, count]) => (
            <div
              key={hex}
              className="palette-band-cell"
              style={{ background: hex, flexGrow: count }}
              title={`${hex} · ${count} 次`}
            />
          ))}
        </div>
        <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
          {paletteCounts.slice(0, 10).map(([hex, count]) => (
            <span key={hex} className="mini-chip num">
              <span className="color-dot" style={{ background: hex }} />
              {hex}
              <span>{count}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
