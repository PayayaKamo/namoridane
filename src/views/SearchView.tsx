import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { applyFilters, DEFAULT_FILTER } from '../lib/filtering'
import { MONTHS_CN } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Masonry } from '../components/ItemCard'
import { Empty } from '../components/Modal'
import type { FilterState } from '../types'
import { readableInk } from '../lib/colors'

export function SearchView({ route }: { route: Route }) {
  const { items, annotations, tags, dimensions, collections, tagUsage } = useStore()
  const [filter, setFilter] = useState<FilterState>(() => ({
    ...DEFAULT_FILTER,
    keyword: route.query.get('q') ?? '',
    year: route.query.get('year') ?? '',
    collectionId: route.query.get('collection') ?? '',
    tagIds: route.query.get('tag') ? [route.query.get('tag')!] : [],
  }))

  const filtered = useMemo(
    () =>
      applyFilters(
        {
          items,
          annotations,
          tags,
          collectionItemIds: collections.find((c) => c.id === filter.collectionId)?.itemIds,
        },
        filter,
      ),
    [items, annotations, tags, collections, filter],
  )

  const selectedByDim = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const tagId of filter.tagIds) {
      const tag = tags.find((t) => t.id === tagId)
      const dim = tag?.dimensionId ?? 'custom'
      map.set(dim, [...(map.get(dim) ?? []), tagId])
    }
    return map
  }, [filter.tagIds, tags])

  const toggleTag = (tagId: string) =>
    setFilter((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }))

  const setDimMode = (dimId: string, mode: 'any' | 'all') =>
    setFilter((f) => ({ ...f, dimensionModes: { ...f.dimensionModes, [dimId]: mode } }))

  const years = useMemo(() => [...new Set(items.map((i) => i.publishedAt.slice(0, 4)))].sort(), [items])

  const reset = () => setFilter(DEFAULT_FILTER)

  const activeCount =
    (filter.keyword ? 1 : 0) +
    (filter.year ? 1 : 0) +
    (filter.month ? 1 : 0) +
    (filter.from ? 1 : 0) +
    (filter.to ? 1 : 0) +
    filter.tagIds.length +
    (filter.favoriteOnly ? 1 : 0) +
    (filter.unconfirmedOnly ? 1 : 0) +
    (filter.collectionId ? 1 : 0)

  return (
    <div className="search-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Search & Filter</div>
          <h2 className="page-title">搜索与筛选</h2>
          <div className="page-sub">
            共 {filtered.length} 张结果 · 跨维度条件为 AND，维度内可切换任一 / 全部
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={reset}>
            <Icon name="shuffle" size={14} />
            重置全部
          </button>
          <button className="btn" onClick={() => navigate('/gallery')}>
            返回图库
          </button>
        </div>
      </div>

      <div className="search-layout">
        <aside className="filter-panel">
          <div className="field">
            <div className="field-label">关键词</div>
            <div className="top-search" style={{ maxWidth: 'none', marginLeft: 0 }}>
              <Icon name="search" size={14} />
              <input
                value={filter.keyword}
                placeholder="标签、备注、拆解笔记…"
                onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="field">
              <div className="field-label">年份</div>
              <select
                className="select"
                value={filter.year}
                onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value }))}
              >
                <option value="">全部</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">月份</div>
              <select
                className="select"
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
              >
                <option value="">全部</option>
                {MONTHS_CN.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="field">
              <div className="field-label">起始日期</div>
              <input
                type="date"
                className="input"
                value={filter.from}
                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="field">
              <div className="field-label">结束日期</div>
              <input
                type="date"
                className="input"
                value={filter.to}
                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          </div>

          <div className="field">
            <div className="field-label">合集</div>
            <select
              className="select"
              value={filter.collectionId}
              onChange={(e) => setFilter((f) => ({ ...f, collectionId: e.target.value }))}
            >
              <option value="">全部作品</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.itemIds.length}）
                </option>
              ))}
            </select>
          </div>

          <div className="row row-wrap" style={{ gap: 6 }}>
            <button
              className={`chip${filter.favoriteOnly ? ' active' : ''}`}
              onClick={() => setFilter((f) => ({ ...f, favoriteOnly: !f.favoriteOnly }))}
            >
              <Icon name="heart" size={11} />
              只看收藏
            </button>
            <button
              className={`chip${filter.unconfirmedOnly ? ' active' : ''}`}
              onClick={() => setFilter((f) => ({ ...f, unconfirmedOnly: !f.unconfirmedOnly }))}
            >
              <Icon name="check" size={11} />
              只看未校对
            </button>
          </div>

          <div className="divider" />

          <div className="field-label" style={{ marginBottom: 8 }}>
            标签维度
            <span className="faint">已选 {filter.tagIds.length}</span>
          </div>
          <div className="dim-filter-list">
            {dimensions.map((dim) => {
              const dimTags = tags.filter((t) => t.dimensionId === dim.id)
              if (!dimTags.length) return null
              const selected = selectedByDim.get(dim.id) ?? []
              const mode = filter.dimensionModes[dim.id] ?? filter.tagMode
              return (
                <div key={dim.id} className="dim-block">
                  <div className="dim-head">
                    <span>{dim.name}</span>
                    <div className="segmented tiny">
                      <button
                        className={mode === 'any' ? 'active' : ''}
                        onClick={() => setDimMode(dim.id, 'any')}
                        title="维度内任一标签"
                      >
                        任一
                      </button>
                      <button
                        className={mode === 'all' ? 'active' : ''}
                        onClick={() => setDimMode(dim.id, 'all')}
                        title="维度内同时满足"
                      >
                        全部
                      </button>
                    </div>
                  </div>
                  <div className="row row-wrap" style={{ gap: 5 }}>
                    {dimTags.map((tag) => {
                      const active = selected.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          className={`chip chip-tiny${active ? ' active' : ''}`}
                          style={
                            active
                              ? { background: tag.color, borderColor: tag.color, color: readableInk(tag.color) }
                              : undefined
                          }
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                          <span className="chip-count">{tagUsage[tag.id] ?? 0}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {!tags.length && <span className="muted">还没有标签，先到标签页建立自己的维度标签。</span>}
          </div>

          <div className="divider" />
          <div className="field">
            <div className="field-label">排序</div>
            <select
              className="select"
              value={filter.sort}
              onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
            >
              <option value="publishedAsc">发布日 · 早→晚</option>
              <option value="publishedDesc">发布日 · 晚→早</option>
              <option value="diaryAsc">日记日 · 早→晚</option>
              <option value="diaryDesc">日记日 · 晚→早</option>
              <option value="updatedDesc">最近整理</option>
            </select>
          </div>
        </aside>

        <section className="search-results">
          <div className="results-head">
            <span>
              <b className="num">{filtered.length}</b> 张作品
              {activeCount > 0 && <span className="faint"> · {activeCount} 个筛选条件</span>}
            </span>
            <div className="row row-wrap" style={{ gap: 5 }}>
              {filter.tagIds.map((id) => {
                const tag = tags.find((t) => t.id === id)
                if (!tag) return null
                return (
                  <button
                    key={id}
                    className="tag-pill"
                    style={{ ['--tag-color' as string]: tag.color, cursor: 'pointer' }}
                    onClick={() => toggleTag(id)}
                  >
                    {tag.name}
                    <Icon name="close" size={9} />
                  </button>
                )
              })}
            </div>
          </div>
          {filtered.length ? (
            <Masonry items={filtered} />
          ) : (
            <Empty icon="search" title="没有找到作品" hint="换一个关键词，或者减少几个筛选条件。" />
          )}
        </section>
      </div>
    </div>
  )
}
