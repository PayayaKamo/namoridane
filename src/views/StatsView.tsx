import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { CharacterAvatar } from '../components/CharacterAvatar'
import { monthNames, effectiveDate } from '../lib/dates'
import { IS_PUBLIC } from '../lib/appMode'
import { navigate } from '../lib/router'
import { useI18n } from '../i18n'

const CAST_RADIUS = 62
const CAST_CIRC = 2 * Math.PI * CAST_RADIUS

export function StatsView() {
  const {
    items,
    confirmedDiaryItems,
    annotations,
    tags,
    tagMap,
    dimensions,
    tagUsage,
    collections,
    data,
    getDate,
  } = useStore()
  const { t } = useI18n()
  const [openDims, setOpenDims] = useState<Record<string, boolean>>({})
  const [hoveredCast, setHoveredCast] = useState<'single' | 'double' | 'multi' | null>(null)
  const [castTab, setCastTab] = useState<'single' | 'double' | 'multi'>(() => {
    const saved = localStorage.getItem('namori.stats.castTab')
    return saved === 'double' || saved === 'multi' ? saved : 'single'
  })
  const changeCastTab = (tab: 'single' | 'double' | 'multi') => {
    setCastTab(tab)
    localStorage.setItem('namori.stats.castTab', tab)
  }
  const [year, setYear] = useState(() => {
    // 无年份归属的条目（year 为 0）不参与年度分组
    const years = [...new Set(items.map((i) => getDate(i).year).filter((y) => y > 0))].sort()
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
      // 没有日期的条目不参与覆盖跨度，避免把起始日期清空
      if (d.iso) {
        if (!minDate || d.iso < minDate) minDate = d.iso
        if (!maxDate || d.iso > maxDate) maxDate = d.iso
      }
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
      if (!y) continue // 没有年份归属的条目不生成年份分组
      counts.set(y, (counts.get(y) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0])
  }, [items, getDate])

  const maxYear = Math.max(1, ...yearCounts.map(([, c]) => c))

  const monthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    for (const item of items) {
      const d = getDate(item)
      if (d.year === year && counts[d.month - 1] !== undefined) counts[d.month - 1]++
    }
    return counts
  }, [items, getDate, year])
  const maxMonth = Math.max(1, ...monthCounts)

  const monthDays = useMemo(() => {
    const sets = Array.from({ length: 12 }, () => new Set<string>())
    for (const item of items) {
      const d = getDate(item)
      const bucket = d.year === year ? sets[d.month - 1] : undefined
      if (bucket) bucket.add(d.iso)
    }
    return sets.map((s) => s.size)
  }, [items, getDate, year])

  const tagGroups = useMemo(
    () =>
      dimensions
        // 人物维度的出场次数已在“角色出场榜”呈现，这里不再重复
        .filter((dim) => dim.id !== 'character')
        .map((dim) => ({
          dim,
          tags: tags
            .filter((t) => t.dimensionId === dim.id && (tagUsage[t.id] ?? 0) > 0)
            .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0)),
        }))
        .filter((g) => g.tags.length > 0),
    [dimensions, tags, tagUsage],
  )

  // 人物组合：管理端取已确认绘日记，公开端取公开数据集（不含审核状态）
  const castItems = IS_PUBLIC ? items : confirmedDiaryItems
  const cast = useMemo(() => {
    const charTagIds = new Set(tags.filter((tag) => tag.dimensionId === 'character').map((tag) => tag.id))
    const pairCounts = new Map<string, number>()
    const groupCounts = new Map<string, number>()
    const singleCounts = new Map<string, number>()
    let single = 0
    let double = 0
    let multi = 0
    for (const item of castItems) {
      const ids = [...new Set((annotations[item.id]?.tags ?? []).filter((id) => charTagIds.has(id)))].sort()
      if (!ids.length) continue
      if (ids.length === 1) {
        single++
        singleCounts.set(ids[0], (singleCounts.get(ids[0]) ?? 0) + 1)
        continue
      }
      if (ids.length === 2) {
        double++
      } else {
        multi++
        const groupKey = ids.join('|')
        groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1)
      }
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const key = `${ids[i]}|${ids[j]}`
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
        }
      }
    }
    const toRanking = (counts: Map<string, number>) =>
      [...counts.entries()]
        .map(([key, count]) => ({ ids: key.split('|'), count }))
        .sort((a, b) => b.count - a.count || a.ids.join().localeCompare(b.ids.join()))
    return {
      single,
      double,
      multi,
      total: single + double + multi,
      pairImages: double + multi,
      pairs: toRanking(pairCounts),
      singles: toRanking(singleCounts),
      groups: toRanking(groupCounts),
    }
  }, [castItems, annotations, tags])

  const characterRank = useMemo(() => {
    return tags
      .filter((tag) => tag.dimensionId === 'character' && (tagUsage[tag.id] ?? 0) > 0)
      .map((tag) => ({ id: tag.id, count: tagUsage[tag.id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  }, [tags, tagUsage])
  const characterTotal = characterRank.reduce((sum, row) => sum + row.count, 0)

  const pct = (count: number, total: number) => (total ? `${Math.round((count / total) * 100)}%` : '0%')
  const months = monthNames()

  const openCharacter = (id: string) => navigate(`/characters?char=${encodeURIComponent(id)}`)

  const castAvatarLink = (id: string) => (
    <button
      key={id}
      type="button"
      className="cast-avatar-btn"
      onClick={() => openCharacter(id)}
      title={t('stats.characterTooltip', { name: tagMap.get(id)?.name ?? id })}
    >
      {castAvatar(id)}
    </button>
  )

  const castNameLinks = (ids: string[]) =>
    ids.map((id, index) => (
      <span key={id}>
        <button type="button" className="cast-name-link" onClick={() => openCharacter(id)}>
          {tagMap.get(id)?.name ?? id}
        </button>
        {index < ids.length - 1 ? <span className="cast-sep"> × </span> : null}
      </span>
    ))

  const castAvatar = (id: string) => <CharacterAvatar tagId={id} className="cast-avatar" />

  return (
    <div className="stats-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.stats.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.stats.title')}</h2>
          <div className="page-sub">
            {t('stats.overview.subtitle', {
              from: summary.minDate,
              to: summary.maxDate,
              count: items.length,
              posts: summary.posts,
            })}
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="gallery" size={16} /></span>
            <span className="stat-label">{t('stats.cards.works')}</span>
          </div>
          <div className="stat-value num">{items.length}</div>
          <div className="stat-hint">{t('stats.cards.multiPosts', { count: summary.multi })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="calendar" size={16} /></span>
            <span className="stat-label">{t('stats.cards.drawingDays')}</span>
          </div>
          <div className="stat-value num">{summary.days}</div>
          <div className="stat-hint">{t('stats.cards.longestStreak', { count: summary.longest })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="tag" size={16} /></span>
            <span className="stat-label">{t('stats.cards.tagged')}</span>
          </div>
          <div className="stat-value num">{summary.tagged}</div>
          <div className="stat-hint">
            {IS_PUBLIC
              ? t('stats.cards.tagsCount', { count: tags.length })
              : t('stats.cards.tagsAndCollections', { tags: tags.length, collections: collections.length })}
          </div>
        </div>
        {IS_PUBLIC ? (
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><Icon name="users" size={16} /></span>
              <span className="stat-label">{t('stats.cards.characters')}</span>
            </div>
            <div className="stat-value num">{characterTotal}</div>
            <div className="stat-hint">{t('stats.cards.charactersHint', { count: characterRank.length })}</div>
          </div>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-icon"><Icon name="check" size={16} /></span>
                <span className="stat-label">{t('stats.cards.confirmedDates')}</span>
              </div>
              <div className="stat-value num">{summary.confirmed}</div>
              <div className="stat-hint">{t('stats.cards.pendingReview', { count: items.length - summary.confirmed })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-icon"><Icon name="heart" size={16} /></span>
                <span className="stat-label">{t('stats.cards.favorites')}</span>
              </div>
              <div className="stat-value num">{summary.favorites}</div>
              <div className="stat-hint">{t('stats.cards.favoritesHint', { count: summary.withNotes })}</div>
            </div>
          </>
        )}
      </div>

      <div className="stats-two">
        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.monthly.title')}</h3>
            <select className="select select-mini" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearCounts.map(([y]) => (
                <option key={y} value={y}>
                  {t('common.yearLabel', { year: y })}
                </option>
              ))}
            </select>
          </div>
          <div className="bar-chart">
            {monthCounts.map((count, idx) => (
              <div
                key={idx}
                className="bar-col"
                title={t('stats.monthly.barTooltip', { month: months[idx], count, days: monthDays[idx] })}
              >
                <span className="bar-value num">{count || ''}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${(count / maxMonth) * 100}%` }} />
                </div>
                <span className="bar-label">{idx + 1}</span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            {t('stats.monthly.hint')}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.yearly.title')}</h3>
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
              <span>{t('stats.yearly.average')}</span>
              <span className="num">{t('common.itemCount', { count: (items.length / Math.max(1, summary.days)).toFixed(2) })}</span>
            </div>
            <div className="meta-row">
              <span>{t('stats.yearly.span')}</span>
              <span className="num">{summary.minDate} → {summary.maxDate}</span>
            </div>
            {!IS_PUBLIC && (
              <div className="meta-row">
                <span>{t('stats.yearly.localNotes')}</span>
                <span className="num">{t('stats.yearly.records', { count: Object.keys(data.items).length })}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.tags.title')}</h3>
          <span className="faint">{t('stats.tags.subtitle')}</span>
        </div>
        {tagGroups.length ? (
          <div className="tag-dist-grid">
            {tagGroups.map(({ dim, tags: groupTags }) => {
              const open = openDims[dim.id] ?? false
              const groupTotal = groupTags.reduce((sum, tag) => sum + (tagUsage[tag.id] ?? 0), 0)
              const groupMax = Math.max(1, ...groupTags.map((tag) => tagUsage[tag.id] ?? 0))
              return (
                <div key={dim.id} className={`tag-dist${open ? ' is-open' : ''}`}>
                  <button
                    className="tag-dist-head"
                    onClick={() => setOpenDims((prev) => ({ ...prev, [dim.id]: !open }))}
                    aria-expanded={open}
                  >
                    <span className="field-label">{dim.name}</span>
                    <span className="num faint">{t('stats.tags.groupCount', { items: groupTags.length, uses: groupTotal })}</span>
                    <span className="tag-dist-caret" aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                  {open && (
                    <div className="tag-bars">
                      {groupTags.map((tag) => {
                        const count = tagUsage[tag.id] ?? 0
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className="tag-bar"
                            title={t('stats.tags.barTooltip', { name: tag.name, count })}
                            onClick={() => navigate(`/gallery?tag=${encodeURIComponent(tag.id)}`)}
                          >
                            <span className="tag-bar-track">
                              <span
                                className="tag-bar-fill"
                                style={{ height: `${(count / groupMax) * 100}%`, background: tag.color }}
                              />
                            </span>
                            <span className="num tag-bar-value">{count}</span>
                            <span className="tag-bar-name">{tag.name}</span>
                            <span className="tag-bar-avatar">{castAvatar(tag.id)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="faint">
            {cast.total > 0
              ? IS_PUBLIC
                ? t('stats.tags.emptyOthersPublic')
                : t('stats.tags.emptyOthers')
              : IS_PUBLIC
                ? t('stats.tags.emptyPublic')
                : t('stats.tags.empty')}
          </p>
        )}
      </section>

      {IS_PUBLIC && (
        <section className="panel">
          <div className="panel-head">
            <h3>{t('stats.castRank.title')}</h3>
            <span className="faint">
              {t('stats.castRank.subtitle', { characters: characterRank.length, count: characterTotal })}
            </span>
          </div>
          {characterRank.length ? (
            <div className="cast-pairs">
              {characterRank.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rank-row"
                  onClick={() => openCharacter(row.id)}
                  title={t('stats.characterTooltip', { name: tagMap.get(row.id)?.name ?? row.id })}
                >
                  <span className="cast-avatar-btn">{castAvatar(row.id)}</span>
                  <span className="rank-name">{tagMap.get(row.id)?.name ?? row.id}</span>
                  <span className="cast-pair-track">
                    <span
                      className="cast-pair-fill"
                      style={{ width: `${(row.count / Math.max(1, characterRank[0].count)) * 100}%` }}
                    />
                  </span>
                  <span className="num cast-pair-count">
                    {t('stats.castRank.count', { count: row.count, percent: pct(row.count, characterTotal) })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="faint">{t('stats.castRank.empty')}</p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>{t('stats.cast.title')}</h3>
          <span className="faint">
            {IS_PUBLIC
              ? t('stats.cast.subtitlePublic', { count: cast.total })
              : t('stats.cast.subtitle', { count: cast.total })}
          </span>
        </div>
        <div className="cast-chart">
          <div className="cast-donut">
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <circle className="cast-donut-track" cx="80" cy="80" r={CAST_RADIUS} />
              {(() => {
                let acc = 0
                return (
                  [
                    { key: 'single', count: cast.single, label: t('stats.cast.single'), color: 'var(--accent)' },
                    { key: 'double', count: cast.double, label: t('stats.cast.double'), color: 'var(--sage)' },
                    { key: 'multi', count: cast.multi, label: t('stats.cast.multi'), color: 'var(--gold)' },
                  ] as const
                ).map((seg) => {
                  const frac = cast.total ? seg.count / cast.total : 0
                  const dash = frac * CAST_CIRC
                  const offset = -acc * CAST_CIRC
                  acc += frac
                  if (dash <= 0) return null
                  const active = castTab === seg.key || hoveredCast === seg.key
                  const dim = hoveredCast !== null && hoveredCast !== seg.key
                  return (
                    <circle
                      key={seg.key}
                      className={`cast-donut-seg${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`}
                      cx="80"
                      cy="80"
                      r={CAST_RADIUS}
                      stroke={seg.color}
                      strokeWidth={active ? 24 : 17}
                      strokeDasharray={`${Math.max(dash - 2, 0.5)} ${CAST_CIRC - Math.max(dash - 2, 0.5)}`}
                      strokeDashoffset={offset}
                      onMouseEnter={() => setHoveredCast(seg.key)}
                      onMouseLeave={() => setHoveredCast(null)}
                      onClick={() => changeCastTab(seg.key)}
                    >
                      <title>{`${seg.label} · ${seg.count} · ${pct(seg.count, cast.total)}`}</title>
                    </circle>
                  )
                })
              })()}
            </svg>
            <div className="cast-donut-center">
              <strong className="num">{cast.total}</strong>
              <span>{t('stats.cast.centerHint')}</span>
            </div>
          </div>
          <div className="cast-legend" role="tablist" aria-label={t('stats.cast.chartAria')}>
            {(
              [
                { key: 'single', label: t('stats.cast.single'), count: cast.single, hint: t('stats.cast.singleHint'), color: 'var(--accent)' },
                { key: 'double', label: t('stats.cast.double'), count: cast.double, hint: t('stats.cast.doubleHint'), color: 'var(--sage)' },
                { key: 'multi', label: t('stats.cast.multi'), count: cast.multi, hint: t('stats.cast.multiHint'), color: 'var(--gold)' },
              ] as const
            ).map((tabItem) => (
              <button
                key={tabItem.key}
                role="tab"
                aria-selected={castTab === tabItem.key}
                className={`cast-legend-row${castTab === tabItem.key ? ' active' : ''}${
                  hoveredCast !== null && hoveredCast !== tabItem.key ? ' is-dim' : ''
                }`}
                onMouseEnter={() => setHoveredCast(tabItem.key)}
                onMouseLeave={() => setHoveredCast(null)}
                onFocus={() => setHoveredCast(tabItem.key)}
                onBlur={() => setHoveredCast(null)}
                onClick={() => changeCastTab(tabItem.key)}
              >
                <span className="cast-legend-swatch" style={{ background: tabItem.color }} />
                <span className="cast-legend-text">
                  <b>{tabItem.label}</b>
                  <span>{tabItem.hint}</span>
                </span>
                <span className="cast-legend-value">
                  <b className="num">{tabItem.count}</b>
                  <span>{pct(tabItem.count, cast.total)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {castTab === 'single' &&
          (cast.singles.length ? (
            <>
              <p className="cast-note">{t('stats.cast.singleNote', { total: cast.total })}</p>
              <div className="cast-pairs">
                {cast.singles.map((row) => (
                  <div key={row.ids[0]} className="cast-pair-row">
                    <span className="cast-pair-who">{castAvatarLink(row.ids[0])}</span>
                    <span className="cast-pair-name">{castNameLinks(row.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(row.count / Math.max(1, cast.singles[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: row.count, percent: pct(row.count, cast.single) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.singleEmptyPublic') : t('stats.cast.singleEmpty')}
            </p>
          ))}

        {castTab === 'double' &&
          (cast.pairs.length ? (
            <>
              <p className="cast-note">{t('stats.cast.doubleNote', { count: cast.pairImages })}</p>
              <div className="cast-pairs">
                {cast.pairs.map((pair) => (
                  <div key={pair.ids.join('|')} className="cast-pair-row">
                    <span className="cast-pair-who">
                      {castAvatarLink(pair.ids[0])}
                      {castAvatarLink(pair.ids[1])}
                    </span>
                    <span className="cast-pair-name">{castNameLinks(pair.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(pair.count / Math.max(1, cast.pairs[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: pair.count, percent: pct(pair.count, cast.pairImages) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.doubleEmptyPublic') : t('stats.cast.doubleEmpty')}
            </p>
          ))}

        {castTab === 'multi' &&
          (cast.groups.length ? (
            <>
              <p className="cast-note">{t('stats.cast.multiNote')}</p>
              <div className="cast-pairs">
                {cast.groups.map((group) => (
                  <div key={group.ids.join('|')} className="cast-pair-row is-group">
                    <span className="cast-pair-who">
                      {group.ids.slice(0, 3).map((id) => castAvatarLink(id))}
                    </span>
                    <span className="cast-pair-name">{castNameLinks(group.ids)}</span>
                    <span className="cast-pair-track">
                      <span
                        className="cast-pair-fill"
                        style={{ width: `${(group.count / Math.max(1, cast.groups[0].count)) * 100}%` }}
                      />
                    </span>
                    <span className="num cast-pair-count">
                      {t('stats.cast.countPercent', { count: group.count, percent: pct(group.count, cast.multi) })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC ? t('stats.cast.multiEmptyPublic') : t('stats.cast.multiEmpty')}
            </p>
          ))}
      </section>
    </div>
  )
}
