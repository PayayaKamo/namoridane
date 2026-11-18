import { useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { applyFilters, DEFAULT_FILTER, groupByMonth } from '../lib/filtering'
import { monthNames } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Masonry } from '../components/ItemCard'
import { Empty, Modal } from '../components/Modal'
import { TagPicker } from '../components/TagPicker'
import { CharacterPicker } from '../components/CharacterPicker'
import {
  countZipVolumes,
  downloadBlob,
  downloadOriginalsZip,
  estimateZipBytes,
  formatBytes,
  ZIP_CONFIRM_BYTES,
  ZIP_CONFIRM_ITEM_COUNT,
} from '../lib/image'
import type { ZipProgress } from '../lib/image'
import { IS_PUBLIC } from '../lib/appMode'
import { useI18n } from '../i18n'
import { moveFilesToTrash } from '../lib/trash'
import { applyItemSeo } from '../lib/seo'
import type { DiaryItem, FilterState } from '../types'

export function GalleryView({ route }: { route: Route }) {
  const {
    items,
    excludedItems,
    confirmedDiaryItems,
    pendingReviewItems,
    itemMap,
    annotations,
    tags,
    collections,
    storylines,
    data,
    addTagToItems,
    removeTagFromItems,
    setFavorite,
    setReviewStatus,
    confirmDate,
    addToCollection,
    addCollection,
    addStoryline,
    addToStoryline,
    deleteItems,
    getDate,
    tagMap,
    notify,
  } = useStore()
  const { t } = useI18n()
  const months = monthNames()

  const [filter, setFilter] = useState<FilterState>(() => {
    const q = route.query
    const tag = q.get('tag')
    const tagList = q.get('tags')
    return {
      ...DEFAULT_FILTER,
      year: q.get('year') ?? '',
      month: q.get('month') ?? '',
      keyword: q.get('q') ?? '',
      tagIds: tagList ? tagList.split(',').filter(Boolean) : tag ? [tag] : [],
      tagMode: q.get('tagMode') === 'all' ? 'all' : DEFAULT_FILTER.tagMode,
      favoriteOnly: q.get('fav') === '1',
      unconfirmedOnly: q.get('pending') === '1',
      collectionId: q.get('collection') ?? '',
      sort: (q.get('sort') as FilterState['sort']) || 'diaryAsc',
    }
  })

  const [selectMode, setSelectMode] = useState(false)
  // 管理端默认只看已确认的绘日记；?diary=all 显示全部条目
  const [diaryOnly, setDiaryOnly] = useState(route.query.get('diary') !== 'all')
  const [showExcluded, setShowExcluded] = useState(route.query.get('excluded') === '1')
  const [zipState, setZipState] = useState<ZipProgress | null>(null)
  const [zipConfirm, setZipConfirm] = useState<{ items: DiaryItem[]; bytes: number; volumes: number } | null>(null)
  const zipAbortRef = useRef<AbortController | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagModal, setTagModal] = useState(false)
  const [characterModal, setCharacterModal] = useState(false)
  const [pickCharacters, setPickCharacters] = useState<string[]>([])
  const [pickTags, setPickTags] = useState<string[]>([])
  const [collectionModal, setCollectionModal] = useState(false)
  const [newCollection, setNewCollection] = useState('')
  const [storylineIds, setStorylineIds] = useState<string[] | null>(null)
  const [newStoryline, setNewStoryline] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(
    route.query.get('tag') !== null || route.query.get('tags') !== null,
  )
  // 手机端顶部控件默认收起，只留一行紧凑入口
  const [filtersOpen, setFiltersOpen] = useState(false)

  // 支持 #/gallery?tag=… 直接打开；同一页面内切换 tag 参数时同步筛选
  const queryTag = route.query.get('tag') ?? ''
  useEffect(() => {
    if (!queryTag) return
    setFilter((f) => (f.tagIds.length === 1 && f.tagIds[0] === queryTag ? f : { ...f, tagIds: [queryTag] }))
    setTagFilterOpen(true)
  }, [queryTag])

  // 支持 #/gallery?tags=a,b&tagMode=all 多标签筛选（角色共现等入口使用）
  const queryTags = route.query.get('tags') ?? ''
  useEffect(() => {
    if (!queryTags) return
    const ids = queryTags.split(',').filter(Boolean)
    setFilter((f) =>
      ids.length === f.tagIds.length && ids.every((id, index) => f.tagIds[index] === id)
        ? f
        : { ...f, tagIds: ids, tagMode: 'all' },
    )
    setTagFilterOpen(true)
  }, [queryTags])

  // 作品详情使用独立地址：同步标题、描述与分享卡
  const itemForSeo = route.name === 'item' ? itemMap.get(route.param) : undefined
  useEffect(() => {
    if (!itemForSeo) return
    const tagNames = (annotations[itemForSeo.id]?.tags ?? []).flatMap((id) => {
      const tag = tagMap.get(id)
      return tag ? [tag.name] : []
    })
    applyItemSeo(itemForSeo, getDate(itemForSeo), tagNames)
  }, [itemForSeo, annotations, tagMap, getDate])

  const activeFilterCount = [
    filter.keyword !== DEFAULT_FILTER.keyword,
    filter.year !== DEFAULT_FILTER.year,
    filter.month !== DEFAULT_FILTER.month,
    filter.sort !== DEFAULT_FILTER.sort,
    filter.translation !== DEFAULT_FILTER.translation,
    filter.favoriteOnly,
    filter.unconfirmedOnly,
    filter.tagIds.length > 0,
    filter.collectionId !== DEFAULT_FILTER.collectionId,
    !IS_PUBLIC && !diaryOnly,
  ].filter(Boolean).length

  const sourceItems = showExcluded
    ? excludedItems
    : IS_PUBLIC
      ? items
      : diaryOnly
        ? confirmedDiaryItems
        : [...items, ...excludedItems]

  const filtered = useMemo(
    () =>
      applyFilters(
        { items: sourceItems, annotations, tags, collectionItemIds: collections.find((c) => c.id === filter.collectionId)?.itemIds },
        filter,
      ),
    [sourceItems, annotations, tags, collections, filter],
  )

  const groups = useMemo(() => groupByMonth(filtered, annotations), [filtered, annotations])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedIds = useMemo(() => [...selected], [selected])
  const selectedItems = useMemo(
    () => selectedIds.flatMap((id) => {
      const item = itemMap.get(id)
      return item ? [item] : []
    }),
    [selectedIds, itemMap],
  )

  const startZip = async (targets: DiaryItem[]) => {
    if (!targets.length || zipState) return
    setZipConfirm(null)
    const controller = new AbortController()
    zipAbortRef.current = controller
    setZipState({ done: 0, total: targets.length, volume: 1, volumes: countZipVolumes(targets) })
    try {
      const result = await downloadOriginalsZip(targets, {
        signal: controller.signal,
        onProgress: setZipState,
      })
      if (result.canceled) {
        notify(t('browse.gallery.toastZipCanceled', { done: result.packed, total: targets.length }), 'default')
      } else if (result.failed.length) {
        const files = result.failed
          .slice(0, 3)
          .map((failure) => failure.file)
          .join(', ')
        const more = result.failed.length > 3 ? ` +${result.failed.length - 3}` : ''
        notify(
          t('browse.gallery.toastZipPartial', {
            done: result.packed,
            failed: result.failed.length,
            files: `${files}${more}`,
          }),
          'error',
        )
      } else {
        notify(t('browse.gallery.toastZipDone', { count: result.packed }), 'success')
      }
    } catch (err) {
      console.error(err)
      notify(t('browse.gallery.toastZipFailed'), 'error')
    } finally {
      zipAbortRef.current = null
      setZipState(null)
    }
  }

  const downloadSelected = () => {
    if (!selectedItems.length || zipState) return
    const bytes = estimateZipBytes(selectedItems)
    if (selectedItems.length > ZIP_CONFIRM_ITEM_COUNT || bytes > ZIP_CONFIRM_BYTES) {
      setZipConfirm({ items: selectedItems, bytes, volumes: countZipVolumes(selectedItems) })
      return
    }
    void startZip(selectedItems)
  }

  const cancelZip = () => zipAbortRef.current?.abort()

  const exportExcluded = () => {
    const text = excludedItems.map((item) => item.file).join('\r\n')
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'namori-excluded-files.txt')
    notify(t('browse.gallery.toastExported', { count: excludedItems.length }), 'success')
  }

  const clearSelection = () => setSelected(new Set())

  const toggleTagFilter = (tagId: string) => {
    setFilter((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }))
  }

  const years = useMemo(
    () => [...new Set(sourceItems.map((i) => i.publishedAt.slice(0, 4)).filter(Boolean))].sort(),
    [sourceItems],
  )

  return (
    <div className={`gallery-view${filtersOpen ? ' is-filters-open' : ''}`}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">
            {showExcluded ? t('browse.gallery.excludedEyebrow') : t('shell.page.gallery.eyebrow')}
          </div>
          <h2 className="page-title">
            {showExcluded ? t('browse.gallery.excludedTitle') : t('shell.page.gallery.title')}
          </h2>
          <div className="page-sub">
            {t('browse.gallery.summary', {
              shown: filtered.length,
              total: sourceItems.length,
              months: groups.length,
            })}
            {!IS_PUBLIC &&
              !showExcluded &&
              (diaryOnly ? t('browse.gallery.summaryDiaryOnly') : t('browse.gallery.summaryAll'))}
            {!showExcluded && t('browse.gallery.summaryDefaultSort')}
            {filter.tagIds.length > 0 && t('browse.gallery.summaryTagFilter', { count: filter.tagIds.length })}
          </div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <>
              <button className="btn" onClick={() => navigate('/diary-review')}>
                <Icon name="checkSquare" size={15} />
                {t('browse.gallery.reviewDiary', { count: pendingReviewItems.length })}
              </button>
              <button
                className={`btn${showExcluded ? ' btn-primary' : ''}`}
                onClick={() => {
                  setShowExcluded((value) => !value)
                  clearSelection()
                }}
              >
                <Icon name={showExcluded ? 'gallery' : 'trash'} size={15} />
                {showExcluded
                  ? t('browse.gallery.backToGallery')
                  : t('browse.gallery.excludedToggle', { count: excludedItems.length })}
              </button>
              <button
                className={`btn${selectMode ? ' btn-primary' : ''}`}
                onClick={() => {
                  setSelectMode((v) => !v)
                  clearSelection()
                }}
              >
                <Icon name="checkSquare" size={15} />
                {selectMode ? t('browse.gallery.exitSelect') : t('browse.gallery.enterSelect')}
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/search')}>
            <Icon name="filter" size={15} />
            {t('browse.gallery.advancedFilter')}
          </button>
        </div>
      </div>

      {!IS_PUBLIC && showExcluded && (
        <div className="excluded-banner">
          <div>
            <strong>{t('browse.gallery.excludedBannerTitle')}</strong>
            <span>{t('browse.gallery.excludedBannerHint')}</span>
          </div>
          <button className="btn btn-sm" onClick={exportExcluded} disabled={!excludedItems.length}>
            <Icon name="download" size={14} />
            {t('browse.gallery.exportExcluded')}
          </button>
        </div>
      )}

      <div className="gallery-toolbar">
        <button
          className={`gallery-toolbar-toggle${filtersOpen ? ' is-open' : ''}`}
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
        >
          <Icon name="filter" size={14} />
          <span>{t('browse.gallery.toolbarToggle')}</span>
          {activeFilterCount > 0 && <span className="gallery-toolbar-count">{activeFilterCount}</span>}
          <Icon name={filtersOpen ? 'up' : 'down'} size={13} className="gallery-toolbar-chevron" />
        </button>
        <div className="top-search" style={{ maxWidth: 300, marginLeft: 0 }}>
          <Icon name="search" size={14} />
          <input
            value={filter.keyword}
            placeholder={t('browse.gallery.searchPlaceholder')}
            onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
          />
        </div>
        <select
          className="select"
          style={{ width: 106 }}
          value={filter.year}
          onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value }))}
        >
          <option value="">{t('browse.gallery.allYears')}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {t('common.yearLabel', { year: y })}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 92 }}
          value={filter.month}
          onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
        >
          <option value="">{t('browse.gallery.allMonths')}</option>
          {months.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 132 }}
          value={filter.sort}
          onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
        >
          <option value="publishedAsc">{t('browse.gallery.sortPublishedAsc')}</option>
          <option value="publishedDesc">{t('browse.gallery.sortPublishedDesc')}</option>
          <option value="diaryAsc">{t('browse.gallery.sortDiaryAsc')}</option>
          <option value="diaryDesc">{t('browse.gallery.sortDiaryDesc')}</option>
          <option value="updatedDesc">{t('browse.gallery.sortUpdatedDesc')}</option>
        </select>
        <select
          className="select"
          style={{ width: 112 }}
          value={filter.translation}
          onChange={(e) => setFilter((f) => ({ ...f, translation: e.target.value as FilterState['translation'] }))}
        >
          <option value="any">{t('browse.gallery.translationAny')}</option>
          <option value="none">{t('browse.gallery.translationNone')}</option>
          <option value="translated">{t('browse.gallery.translationTranslated')}</option>
        </select>
        <div className="row" style={{ gap: 6 }}>
          {!IS_PUBLIC && (
            <>
              <button
                className={`chip${diaryOnly ? ' active' : ''}`}
                onClick={() => setDiaryOnly((value) => !value)}
                title={t('browse.gallery.diaryOnlyHint')}
              >
                <Icon name="book" size={11} />
                {t('browse.gallery.diaryOnly')}
              </button>
              <button
                className={`chip${filter.favoriteOnly ? ' active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, favoriteOnly: !f.favoriteOnly }))}
              >
                <Icon name="heart" size={11} />
                {t('browse.gallery.favoriteOnly')}
              </button>
              <button
                className={`chip${filter.unconfirmedOnly ? ' active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, unconfirmedOnly: !f.unconfirmedOnly }))}
              >
                <Icon name="check" size={11} />
                {t('browse.gallery.pendingOnly')}
              </button>
            </>
          )}
          <button className={`chip${tagFilterOpen ? ' active' : ''}`} onClick={() => setTagFilterOpen((v) => !v)}>
            <Icon name="tag" size={11} />
            {filter.tagIds.length
              ? t('browse.gallery.tagsWithCount', { count: filter.tagIds.length })
              : t('common.tags')}
          </button>
        </div>
        <div className="spacer" />
        {!IS_PUBLIC && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setStorylineIds(filtered.map((i) => i.id))}
              disabled={!filtered.length}
              title={t('browse.gallery.addFilteredToStorylineHint')}
            >
              <Icon name="book" size={13} />
              {t('browse.gallery.addFilteredToStoryline')}
            </button>
            {selectMode && (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => setSelected(new Set(filtered.map((i) => i.id)))}
                >
                  {t('browse.gallery.selectAll')}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={clearSelection} disabled={!selected.size}>
                  {t('common.clear')}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {tagFilterOpen && (
        <div className="panel tag-filter-panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="field-label">{t('browse.gallery.tagFilterLabel')}</span>
            <div className="segmented">
              <button
                className={filter.tagMode === 'any' ? 'active' : ''}
                onClick={() => setFilter((f) => ({ ...f, tagMode: 'any' }))}
              >
                {t('common.any')}
              </button>
              <button
                className={filter.tagMode === 'all' ? 'active' : ''}
                onClick={() => setFilter((f) => ({ ...f, tagMode: 'all' }))}
              >
                {t('common.all')}
              </button>
            </div>
          </div>
          <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
            {tags.length ? (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`chip${filter.tagIds.includes(tag.id) ? ' active' : ''}`}
                  style={filter.tagIds.includes(tag.id) ? { background: tag.color, borderColor: tag.color, color: '#fff' } : undefined}
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  {tag.name}
                </button>
              ))
            ) : (
              <span className="muted">{t('browse.gallery.noTags')}</span>
            )}
            {filter.tagIds.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter((f) => ({ ...f, tagIds: [] }))}>
                {t('browse.gallery.clearTags')}
              </button>
            )}
          </div>
        </div>
      )}

      {!groups.length ? (
        !sourceItems.length ? (
          <Empty
            icon="image"
            title={t('browse.gallery.emptyNoItemsTitle')}
            hint={IS_PUBLIC ? t('browse.gallery.emptyNoItemsPublic') : t('browse.gallery.emptyNoItemsHint')}
          />
        ) : (
          <Empty
            icon="image"
            title={
              showExcluded ? t('browse.gallery.emptyExcludedTitle') : t('browse.gallery.emptyFilteredTitle')
            }
            hint={
              showExcluded ? t('browse.gallery.emptyExcludedHint') : t('browse.gallery.emptyFilteredHint')
            }
            action={
              <button className="btn btn-sm" onClick={() => setFilter(DEFAULT_FILTER)}>
                {t('browse.gallery.resetFilters')}
              </button>
            }
          />
        )
      ) : (
        <div className="gallery-groups">
          {groups.map((group) => (
            <section key={group.key} className="gallery-group">
              <div className="group-head">
                <h3>
                  {group.key === 'unknown'
                    ? t('common.dateUnknown')
                    : t('browse.gallery.groupTitle', { year: group.year, month: months[group.month - 1] })}
                  <span className="group-count num">{t('common.itemCount', { count: group.items.length })}</span>
                </h3>
                {group.key !== 'unknown' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/calendar?y=${group.year}&m=${group.month}`)}
                  >
                    {t('browse.gallery.viewInCalendar')}
                    <Icon name="right" size={12} />
                  </button>
                )}
              </div>
              <Masonry
                items={group.items}
                selectable={!IS_PUBLIC && selectMode}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            </section>
          ))}
        </div>
      )}

      {!IS_PUBLIC && ((selectMode && selected.size > 0) || zipState) && (
        <div className="selection-bar">
          {zipState ? (
            <>
              <span className="zip-progress">
                <Icon name="download" size={13} />
                <strong className="num">
                  {zipState.done} / {zipState.total}
                </strong>
                {zipState.volumes > 1 && (
                  <span className="faint">
                    {t('browse.gallery.zipVolume', { volume: zipState.volume, volumes: zipState.volumes })}
                  </span>
                )}
              </span>
              <div className="divider-v" />
              <button className="btn btn-sm" onClick={cancelZip}>
                <Icon name="close" size={13} />
                {t('browse.gallery.zipCancel')}
              </button>
            </>
          ) : (
            <>
          <span className="selection-count num">{t('common.selectedCount', { count: selected.size })}</span>
          <div className="divider-v" />
          <button className="btn btn-sm btn-soft" onClick={downloadSelected}>
            <Icon name="download" size={13} />
            {t('browse.gallery.zipButton')}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setPickTags([]); setTagModal(true) }}>
            <Icon name="tag" size={13} />
            {t('browse.gallery.tagAction')}
          </button>
          <button
            className="btn btn-sm btn-soft"
            onClick={() => {
              setPickCharacters([])
              setCharacterModal(true)
            }}
          >
            <Icon name="users" size={13} />
            {t('browse.gallery.charactersAction')}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setFavorite(selectedIds, true); notify(t('browse.gallery.toastFavorited', { count: selectedIds.length }), 'success') }}>
            <Icon name="heart" size={13} />
            {t('common.favorite')}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setFavorite(selectedIds, false); notify(t('browse.gallery.toastUnfavorited'), 'success') }}>
            {t('browse.gallery.unfavorite')}
          </button>
          <button
            className="btn btn-sm btn-soft"
            onClick={() => { confirmDate(selectedIds, 'suggested'); notify(t('browse.gallery.toastConfirmedInferred', { count: selectedIds.length }), 'success') }}
          >
            <Icon name="check" size={13} />
            {t('browse.gallery.confirmInferred')}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => setCollectionModal(true)}>
            <Icon name="folder" size={13} />
            {t('browse.gallery.addToCollection')}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => setStorylineIds(selectedIds)}>
            <Icon name="book" size={13} />
            {t('browse.gallery.addToStoryline')}
          </button>
          {!showExcluded && (
            <button
              className="btn btn-sm btn-soft"
              onClick={() => {
                setReviewStatus(selectedIds, 'diary')
                notify(t('browse.gallery.toastConfirmedDiary', { count: selectedIds.length }), 'success')
                clearSelection()
              }}
            >
              <Icon name="check" size={13} />
              {t('browse.gallery.confirmDiary')}
            </button>
          )}
          <button
            className={`btn btn-sm${showExcluded ? ' btn-primary' : ' btn-danger'}`}
            onClick={() => {
              setReviewStatus(selectedIds, showExcluded ? 'diary' : 'not_diary')
              notify(
                showExcluded
                  ? t('browse.gallery.toastRestoredDiary', { count: selectedIds.length })
                  : t('browse.gallery.toastMarkedNotDiary', { count: selectedIds.length }),
                'success',
              )
              clearSelection()
            }}
          >
            <Icon name={showExcluded ? 'check' : 'close'} size={13} />
            {showExcluded ? t('browse.gallery.restoreDiary') : t('browse.gallery.markNotDiary')}
          </button>
          <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteOpen(true)}>
            <Icon name="trash" size={13} />
            {t('common.delete')}
          </button>
          <button className="icon-btn" onClick={clearSelection} aria-label={t('browse.gallery.clearSelection')}>
            <Icon name="close" size={14} />
          </button>
            </>
          )}
        </div>
      )}

      {!IS_PUBLIC && zipConfirm && (
        <Modal title={t('browse.gallery.zipConfirmTitle', { count: zipConfirm.items.length })} onClose={() => setZipConfirm(null)}>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            {t('browse.gallery.zipConfirmBody', { size: formatBytes(zipConfirm.bytes) })}
            {zipConfirm.volumes > 1 && (
              <>
                <br />
                {t('browse.gallery.zipConfirmVolumes', { volumes: zipConfirm.volumes })}
              </>
            )}
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setZipConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" onClick={() => void startZip(zipConfirm.items)}>
              {t('browse.gallery.zipConfirmStart')}
            </button>
          </div>
        </Modal>
      )}

      {!IS_PUBLIC && deleteOpen && (
        <Modal title={t('browse.gallery.deleteTitle', { count: selectedIds.length })} onClose={() => setDeleteOpen(false)}>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            {t('browse.gallery.deleteBodyBeforeTrash')}
            <code> images/_trash/</code>
            {t('browse.gallery.deleteBodyBeforeDev')}
            <code>npm run dev</code>
            {t('browse.gallery.deleteBodyBetween')}
            <code>npm run purge</code>
            {t('browse.gallery.deleteBodyAfter')}
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-danger-ghost"
              onClick={async () => {
                const files = selectedItems.map((item) => item.file)
                const moved = await moveFilesToTrash(files)
                deleteItems(selectedIds)
                notify(
                  moved
                    ? t('browse.gallery.toastMovedToTrash', { count: selectedIds.length })
                    : t('browse.gallery.toastRemoved', { count: selectedIds.length }),
                  'success',
                )
                setDeleteOpen(false)
                clearSelection()
              }}
            >
              {t('browse.gallery.confirmDelete')}
            </button>
          </div>
        </Modal>
      )}

      {tagModal && (
        <Modal
          title={t('browse.gallery.tagModalTitle', { count: selected.size })}
          onClose={() => setTagModal(false)}
          footer={
            <>
              <button className="btn" onClick={() => setTagModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                disabled={!pickTags.length}
                onClick={() => {
                  removeTagFromItems(selectedIds, pickTags[0])
                  notify(t('browse.gallery.toastTagRemoved'), 'success')
                  setTagModal(false)
                }}
              >
                {t('browse.gallery.removeFirstTag')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickTags.length}
                onClick={() => {
                  pickTags.forEach((tagId) => addTagToItems(selectedIds, tagId))
                  notify(t('browse.gallery.toastTagsAdded', { count: selected.size, tags: pickTags.length }), 'success')
                  setTagModal(false)
                }}
              >
                {t('browse.gallery.addTags')}
              </button>
            </>
          }
        >
          <TagPicker selected={pickTags} onChange={setPickTags} counts={undefined} />
        </Modal>
      )}

      {characterModal && (
        <Modal
          title={t('browse.gallery.characterModalTitle', { count: selected.size })}
          onClose={() => setCharacterModal(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCharacterModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                disabled={!pickCharacters.length}
                onClick={() => {
                  pickCharacters.forEach((tagId) => removeTagFromItems(selectedIds, tagId))
                  notify(t('browse.gallery.toastCharactersRemoved', { count: selected.size }), 'success')
                  setCharacterModal(false)
                }}
              >
                {t('browse.gallery.removeCharacters')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickCharacters.length}
                onClick={() => {
                  pickCharacters.forEach((tagId) => addTagToItems(selectedIds, tagId))
                  notify(
                    t('browse.gallery.toastCharactersAdded', {
                      count: selected.size,
                      characters: pickCharacters.length,
                    }),
                    'success',
                  )
                  setCharacterModal(false)
                }}
              >
                {t('browse.gallery.addCharacters')}
              </button>
            </>
          }
        >
          <CharacterPicker selected={pickCharacters} onChange={setPickCharacters} />
        </Modal>
      )}

      {collectionModal && (
        <Modal
          title={t('browse.gallery.addToCollection')}
          onClose={() => setCollectionModal(false)}
          footer={
            <button className="btn" onClick={() => setCollectionModal(false)}>
              {t('browse.gallery.done')}
            </button>
          }
        >
          <div className="collection-pick-list">
            {collections.map((col) => {
              const added = selectedIds.every((id) => col.itemIds.includes(id))
              return (
                <button
                  key={col.id}
                  className="collection-pick"
                  onClick={() => {
                    addToCollection(col.id, selectedIds)
                    notify(t('browse.gallery.toastAddedToCollection', { name: col.name }), 'success')
                    setCollectionModal(false)
                  }}
                >
                  <Icon name="folder" size={16} />
                  <span>{col.name}</span>
                  <span className="faint">{t('common.itemCount', { count: col.itemIds.length })}</span>
                  {added && <Icon name="check" size={14} />}
                </button>
              )
            })}
          </div>
          <div className="divider" />
          <div className="row">
            <input
              className="input"
              placeholder={t('browse.gallery.newCollectionPlaceholder')}
              value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!newCollection.trim()}
              onClick={() => {
                const col = addCollection(newCollection.trim())
                addToCollection(col.id, selectedIds)
                setNewCollection('')
                notify(t('browse.gallery.toastCollectionCreated', { name: col.name, count: selectedIds.length }), 'success')
                setCollectionModal(false)
              }}
            >
              {t('browse.gallery.createAndAdd')}
            </button>
          </div>
          <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
            {t('browse.gallery.collectionTotal', { count: data.collections.length })}
          </div>
        </Modal>
      )}

      {storylineIds && (
        <Modal
          title={t('browse.gallery.storylineModalTitle', { count: storylineIds.length })}
          onClose={() => setStorylineIds(null)}
          footer={
            <button className="btn" onClick={() => setStorylineIds(null)}>
              {t('browse.gallery.done')}
            </button>
          }
        >
          <div className="collection-pick-list">
            {storylines.map((story) => (
              <button
                key={story.id}
                className="collection-pick"
                onClick={() => {
                  addToStoryline(story.id, storylineIds)
                  notify(t('browse.gallery.toastAddedToCollection', { name: story.title }), 'success')
                  setStorylineIds(null)
                }}
              >
                <Icon name="book" size={16} />
                <span>{story.title}</span>
                <span className="faint">
                  {t('common.itemCount', {
                    count: story.blocks.filter((b) => b.type === 'image').length,
                  })}
                </span>
              </button>
            ))}
          </div>
          <div className="divider" />
          <div className="row">
            <input
              className="input"
              placeholder={t('browse.gallery.newStorylinePlaceholder')}
              value={newStoryline}
              onChange={(e) => setNewStoryline(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!newStoryline.trim()}
              onClick={() => {
                const story = addStoryline(newStoryline.trim(), storylineIds)
                setNewStoryline('')
                notify(
                  t('browse.gallery.toastStorylineCreated', { name: story.title, count: storylineIds.length }),
                  'success',
                )
                setStorylineIds(null)
              }}
            >
              {t('browse.gallery.createAndAdd')}
            </button>
          </div>
          <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
            {t('browse.gallery.storylineHint')}
          </div>
        </Modal>
      )}
    </div>
  )
}
