import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate, openItem } from '../lib/router'
import { useStore } from '../state/store'
import { applyFilters, DEFAULT_FILTER } from '../lib/filtering'
import { monthNames } from '../lib/dates'
import {
  buildSearchDocs,
  clearRecentSearches,
  loadRecentSearches,
  rememberSearch,
  searchDocs,
} from '../lib/search'
import { Icon } from '../components/Icon'
import { Masonry } from '../components/ItemCard'
import { Empty } from '../components/Modal'
import { SearchBar, SearchHitRow } from '../components/SearchBar'
import type { FilterState } from '../types'
import { readableInk } from '../lib/colors'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'
import '../styles-search.css'

export function SearchView({ route }: { route: Route }) {
  const { items, annotations, tags, dimensions, collections, tagUsage } = useStore()
  const { t } = useI18n()
  const months = monthNames()
  const [filter, setFilter] = useState<FilterState>(() => ({
    ...DEFAULT_FILTER,
    keyword: route.query.get('q') ?? '',
    year: route.query.get('year') ?? '',
    collectionId: route.query.get('collection') ?? '',
    tagIds: route.query.get('tag') ? [route.query.get('tag')!] : [],
  }))
  const [matchAll, setMatchAll] = useState(true)
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches())

  // 多字段文档：文案、短码、日期、标签、人物、备注、翻译、拆解、合集
  const docs = useMemo(
    () => buildSearchDocs({ items, annotations, tags, collections }),
    [items, annotations, tags, collections],
  )

  // 关键词以外的筛选条件先收敛范围，再在范围内做相关度搜索
  const baseItems = useMemo(
    () =>
      applyFilters(
        {
          items,
          annotations,
          tags,
          collectionItemIds: collections.find((c) => c.id === filter.collectionId)?.itemIds,
        },
        { ...filter, keyword: '' },
      ),
    [items, annotations, tags, collections, filter],
  )

  const searchResult = useMemo(() => {
    const query = filter.keyword.trim()
    if (!query) return null
    const allowed = new Set(baseItems.map((item) => item.id))
    const scoped = docs.filter((doc) => allowed.has(doc.item.id))
    return searchDocs(scoped, query, { minMatched: matchAll ? undefined : 1 })
  }, [docs, baseItems, filter.keyword, matchAll])

  const filtered = useMemo(
    () => (searchResult ? searchResult.hits.map((hit) => hit.item) : baseItems),
    [searchResult, baseItems],
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

  const remember = (query: string) => setRecent(rememberSearch(query))

  /** 清掉关键词以外的条件，保留当前搜索词 */
  const relaxFilters = () => setFilter((f) => ({ ...DEFAULT_FILTER, keyword: f.keyword }))

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

  const keyword = filter.keyword.trim()
  const hasSearch = Boolean(searchResult && searchResult.keywords.length)

  return (
    <div className="search-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('browse.search.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.search.title')}</h2>
          <div className="page-sub">{t('browse.search.summary', { count: filtered.length })}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={reset}>
            <Icon name="shuffle" size={14} />
            {t('browse.search.resetAll')}
          </button>
          <button className="btn" onClick={() => navigate('/gallery')}>
            {t('browse.gallery.backToGallery')}
          </button>
        </div>
      </div>

      <SearchBar
        query={filter.keyword}
        onChange={(value) => setFilter((f) => ({ ...f, keyword: value }))}
        hits={searchResult?.hits ?? []}
        total={searchResult?.hits.length ?? 0}
        suggestions={searchResult?.suggestions ?? []}
        recent={recent}
        onPickSuggestion={(value) => setFilter((f) => ({ ...f, keyword: value }))}
        onClearRecent={() => setRecent(clearRecentSearches())}
        onPickItem={(id) => openItem(id)}
        onSubmit={(value) => remember(value)}
        onViewAll={() => {
          document.querySelector('.search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      <div className="search-layout">
        <aside className="filter-panel">
          <div className="filter-row">
            <div className="field">
              <div className="field-label">{t('browse.search.yearLabel')}</div>
              <select
                className="select"
                value={filter.year}
                onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value }))}
              >
                <option value="">{t('common.all')}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {t('common.yearLabel', { year: y })}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">{t('browse.search.monthLabel')}</div>
              <select
                className="select"
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
              >
                <option value="">{t('common.all')}</option>
                {months.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="field">
              <div className="field-label">{t('browse.search.fromLabel')}</div>
              <input
                type="date"
                className="input"
                value={filter.from}
                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="field">
              <div className="field-label">{t('browse.search.toLabel')}</div>
              <input
                type="date"
                className="input"
                value={filter.to}
                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          </div>

          <div className="field">
            <div className="field-label">{t('common.collections')}</div>
            <select
              className="select"
              value={filter.collectionId}
              onChange={(e) => setFilter((f) => ({ ...f, collectionId: e.target.value }))}
            >
              <option value="">{t('browse.search.allWorks')}</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {t('browse.search.collectionOption', { name: c.name, count: c.itemIds.length })}
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
              {t('browse.gallery.favoriteOnly')}
            </button>
            {!IS_PUBLIC && (
              <button
                className={`chip${filter.unconfirmedOnly ? ' active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, unconfirmedOnly: !f.unconfirmedOnly }))}
              >
                <Icon name="check" size={11} />
                {t('browse.search.unconfirmedOnly')}
              </button>
            )}
          </div>

          <div className="divider" />

          <div className="field-label" style={{ marginBottom: 8 }}>
            {t('browse.search.tagDimensions')}
            <span className="faint">{t('browse.search.selectedTags', { count: filter.tagIds.length })}</span>
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
                        title={t('browse.search.dimAnyHint')}
                      >
                        {t('common.any')}
                      </button>
                      <button
                        className={mode === 'all' ? 'active' : ''}
                        onClick={() => setDimMode(dim.id, 'all')}
                        title={t('browse.search.dimAllHint')}
                      >
                        {t('common.all')}
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
            {!tags.length && (
              <span className="muted">
                {IS_PUBLIC ? t('browse.search.noTagsPublic') : t('browse.search.noTags')}
              </span>
            )}
          </div>

          <div className="divider" />
          <div className="field">
            <div className="field-label">{t('browse.search.sortLabel')}</div>
            <select
              className="select"
              value={filter.sort}
              onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
            >
              <option value="publishedAsc">{t('browse.search.sortPublishedAsc')}</option>
              <option value="publishedDesc">{t('browse.search.sortPublishedDesc')}</option>
              <option value="diaryAsc">{t('browse.search.sortDiaryAsc')}</option>
              <option value="diaryDesc">{t('browse.search.sortDiaryDesc')}</option>
              <option value="updatedDesc">{t('browse.search.sortUpdatedDesc')}</option>
            </select>
          </div>
        </aside>

        <section className="search-results">
          <div className="results-head">
            <span>
              <b className="num">{filtered.length}</b> {t('browse.search.worksUnit')}
              {keyword && (
                <span className="faint">{t('browse.search.keywordNote', { keyword })}</span>
              )}
              {activeCount > 1 && (
                <span className="faint">{t('browse.search.filterCountNote', { count: activeCount })}</span>
              )}
              {keyword && <span className="search-sort-note">{t('browse.search.relevanceNote')}</span>}
            </span>
            <div className="row row-wrap" style={{ gap: 8 }}>
              {hasSearch && searchResult && searchResult.keywords.length > 1 && (
                <div className="segmented tiny">
                  <button className={matchAll ? 'active' : ''} onClick={() => setMatchAll(true)}>
                    {t('browse.search.allKeywords')}
                  </button>
                  <button className={!matchAll ? 'active' : ''} onClick={() => setMatchAll(false)}>
                    {t('browse.search.anyKeyword')}
                  </button>
                </div>
              )}
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
            hasSearch && searchResult ? (
              <div className="search-hit-list">
                {searchResult.hits.map((hit) => (
                  <SearchHitRow key={hit.item.id} hit={hit} onOpen={openItem} />
                ))}
              </div>
            ) : (
              <Masonry items={filtered} />
            )
          ) : (
            <Empty
              icon="search"
              title={t('browse.search.emptyTitle')}
              hint={
                keyword
                  ? searchResult?.partialCount
                    ? t('browse.search.partialHint', { count: searchResult.partialCount })
                    : t('browse.search.noKeywordHint')
                  : t('browse.search.filtersOnlyHint')
              }
              action={
                <div className="search-suggest-block">
                  {searchResult && searchResult.suggestions.length > 0 && (
                    <>
                      <div className="search-suggest-title">{t('browse.search.suggestSimilar')}</div>
                      <div className="search-suggest-actions">
                        {searchResult.suggestions.map((value) => (
                          <button
                            key={value}
                            className="chip"
                            onClick={() => setFilter((f) => ({ ...f, keyword: value }))}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {searchResult && searchResult.keywords.length > 1 && (
                    <>
                      <div className="search-suggest-title">{t('browse.search.keepOneKeyword')}</div>
                      <div className="search-suggest-actions">
                        {searchResult.keywords.map((value) => (
                          <button
                            key={value}
                            className="chip"
                            onClick={() => setFilter((f) => ({ ...f, keyword: value }))}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="search-suggest-actions">
                    {activeCount > 1 && (
                      <button className="btn btn-sm" onClick={relaxFilters}>
                        <Icon name="shuffle" size={12} />
                        {t('browse.search.clearOtherFilters')}
                      </button>
                    )}
                    {keyword && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setFilter((f) => ({ ...f, keyword: '' }))}
                      >
                        {t('browse.search.clearKeyword')}
                      </button>
                    )}
                  </div>
                </div>
              }
            />
          )}
        </section>
      </div>
    </div>
  )
}
