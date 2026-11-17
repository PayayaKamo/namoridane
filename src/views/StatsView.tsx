import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { MONTHS_CN, effectiveDate } from '../lib/dates'
import { presetAvatarPath } from '../lib/constants'
import { IS_PUBLIC } from '../lib/appMode'
import { navigate } from '../lib/router'

const BASE = import.meta.env.BASE_URL

export function StatsView() {
  const {
    items,
    confirmedDiaryItems,
    annotations,
    tags,
    tagMap,
    dimensions,
    tagUsage,
    characters,
    itemMap,
    collections,
    data,
    getDate,
  } = useStore()
  const [openDims, setOpenDims] = useState<Record<string, boolean>>({ character: true })
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

  const characterMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const pct = (count: number, total: number) => (total ? `${Math.round((count / total) * 100)}%` : '0%')

  const openCharacter = (id: string) => navigate(`/characters?char=${encodeURIComponent(id)}`)

  const castAvatarLink = (id: string) => (
    <button
      key={id}
      type="button"
      className="cast-avatar-btn"
      onClick={() => openCharacter(id)}
      title={`查看「${tagMap.get(id)?.name ?? id}」的角色图鉴`}
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

  const castAvatar = (id: string) => {
    const tag = tagMap.get(id)
    const character = characterMap.get(id)
    const avatarItem = character?.avatarItemId ? itemMap.get(character.avatarItemId) : undefined
    const position = character?.avatarCrop
      ? `${Math.round(character.avatarCrop.cx * 100)}% ${Math.round(character.avatarCrop.cy * 100)}%`
      : '50% 50%'
    return (
      <span key={id} className="cast-avatar" style={{ background: tag?.color }} title={tag?.name}>
        {character?.avatarDataUrl ? (
          <img src={character.avatarDataUrl} alt="" />
        ) : avatarItem ? (
          <img src={`${BASE}${avatarItem.thumb}`} alt="" style={{ objectPosition: position }} />
        ) : character?.avatar ? (
          <img src={`${BASE}${character.avatar}`} alt="" loading="lazy" />
        ) : presetAvatarPath(id) ? (
          <img src={`${BASE}${presetAvatarPath(id)}`} alt="" loading="lazy" />
        ) : (
          (tag?.name ?? '?').slice(0, 1)
        )}
      </span>
    )
  }

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
          <div className="stat-hint">
            {tags.length} 个标签{IS_PUBLIC ? '' : ` · ${collections.length} 个合集`}
          </div>
        </div>
        {IS_PUBLIC ? (
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><Icon name="users" size={16} /></span>
              <span className="stat-label">人物出场</span>
            </div>
            <div className="stat-value num">{characterTotal}</div>
            <div className="stat-hint">{characterRank.length} 位角色有出场记录</div>
          </div>
        ) : (
          <>
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
          </>
        )}
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
            {!IS_PUBLIC && (
              <div className="meta-row">
                <span>本地标注</span>
                <span className="num">{Object.keys(data.items).length} 条记录</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>标签分布</h3>
          <span className="faint">按维度分组 · 全部标签</span>
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
                    <span className="num faint">{groupTags.length} 项 · {groupTotal} 次</span>
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
                            title={`${tag.name} · ${count} 次 · 点击查看相关作品`}
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
            {IS_PUBLIC
              ? '目前还没有可展示的标签分布。'
              : '还没有使用标签。去图库多选作品批量打标签后，这里会出现分布。'}
          </p>
        )}
      </section>

      {IS_PUBLIC && (
        <section className="panel">
          <div className="panel-head">
            <h3>角色出场榜</h3>
            <span className="faint">
              {characterRank.length} 位角色 · 累计 {characterTotal} 次出场
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
                  title={`查看「${tagMap.get(row.id)?.name ?? row.id}」的角色图鉴`}
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
                    {row.count} 次 · {pct(row.count, characterTotal)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="faint">目前还没有公开的角色出场记录。</p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>人物组合</h3>
          <span className="faint">
            仅统计{IS_PUBLIC ? '公开的' : '已确认的'}绘日记 · 共 {cast.total} 张有人物标注
          </span>
        </div>
        <div className="cast-tabs" role="tablist" aria-label="人物组合">
          {(
            [
              { key: 'single', label: '单人', count: cast.single, hint: '仅一人出镜' },
              { key: 'double', label: '双人', count: cast.double, hint: 'CP 两两配对' },
              { key: 'multi', label: '多人', count: cast.multi, hint: '3 人及以上' },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.key}
              role="tab"
              aria-selected={castTab === tabItem.key}
              className={`cast-tab${castTab === tabItem.key ? ' active' : ''}`}
              onClick={() => changeCastTab(tabItem.key)}
            >
              <span className="cast-tab-label">
                {tabItem.label} <span className="faint">{tabItem.hint}</span>
              </span>
              <span className="num cast-tab-count">
                {tabItem.count} 张 · {pct(tabItem.count, cast.total)}
              </span>
            </button>
          ))}
        </div>

        {castTab === 'single' &&
          (cast.singles.length ? (
            <>
              <p className="cast-note">
                口径：按角色统计「该图仅此一人出镜」的张数，每张图只计一次；与双人、多人合计等于 {cast.total}{' '}
                张有人物标注的绘日记。
              </p>
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
                      {row.count} 张 · {pct(row.count, cast.single)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC
                ? '目前还没有单人出镜的公开标注。'
                : '还没有「单人出镜」的标注。给只有一位角色的绘日记标上人物后，这里会按角色排名。'}
            </p>
          ))}

        {castTab === 'double' &&
          (cast.pairs.length ? (
            <>
              <p className="cast-note">
                口径：同一张图内的角色两两配对，3 人及以上会拆成多组（如 3 人 = 3
                组），所以占比以「有 2 人及以上标注的 {cast.pairImages} 张」为分母，合计可能超过 100%。完整群像请切到「多人」。
              </p>
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
                      {pair.count} 张 · {pct(pair.count, cast.pairImages)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC
                ? '目前还没有可展示的双人组合。'
                : '暂时没有可配对的出场标注。至少需要一张已确认绘日记标注了 2 位及以上角色，组合才会出现在这里。'}
            </p>
          ))}

        {castTab === 'multi' &&
          (cast.groups.length ? (
            <>
              <p className="cast-note">
                口径：按整组统计（如 A × B × C 记为一组，一张图只计一次），与「双人」页签里把 3
                人拆成 3 组的两两配对不同。
              </p>
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
                      {group.count} 张 · {pct(group.count, cast.multi)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="faint">
              {IS_PUBLIC
                ? '目前还没有 3 人及以上的公开群像。'
                : '还没有 3 人及以上的群像标注。标注多位角色后，完整组合会按张数排在这里。'}
            </p>
          ))}
      </section>
    </div>
  )
}
